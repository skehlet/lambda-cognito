var AWS = require('aws-sdk');
var Config = AWS.Config;
var CognitoIdentityCredentials = AWS.CognitoIdentityCredentials;
var AWSCognito = require('amazon-cognito-identity-js');
var CognitoUser = AWSCognito.CognitoUser;
var CognitoUserPool = AWSCognito.CognitoUserPool;
var CognitoUserAttribute = AWSCognito.CognitoUserAttribute;
var AuthenticationDetails = AWSCognito.AuthenticationDetails;
var https = require('https');
var bl = require('bl');
var async = require('async');

process.stdin.setEncoding('utf8');

// Workaround Cognito bug when you enable "remember your user's devices"
// https://github.com/aws/amazon-cognito-identity-js/issues/231#issuecomment-289891545
global.navigator = () => null;

class Loginer {
    constructor(poolId, clientId) {
        this.poolId = poolId;
        this.clientId = clientId;
    }
    getAuthenticationDetails(username, password) {
        return new AuthenticationDetails({
            Username : username,
            Password: password
        });
    }
    getUserPool() {
        return new CognitoUserPool({
            UserPoolId: this.poolId,
            ClientId: this.clientId,
        });
    }
    getCognitoUser(username) {
        return new CognitoUser({
            Username : username,
            Pool : this.getUserPool()
        })
    }
    login(username, password, onLogin) {
        var cognitoUser = this.getCognitoUser(username);
        cognitoUser.authenticateUser(
            this.getAuthenticationDetails(username, password),
            {
                onSuccess: onLogin,
                onFailure: function (err) {
                    console.error(err);
                },
                mfaRequired: function (codeDeliveryDetails) {
                    // MFA is required to complete user authentication.
                    // Get the code from user and call
                    cognitoUser.sendMFACode(mfaCode, this)
                },
                newPasswordRequired: function(userAttributes, requiredAttributes) {
                    let self = this;
                    // User was signed up by an admin and must provide new
                    // password and required attributes, if any, to complete
                    // authentication.

                    // the api doesn't accept this field back
                    delete userAttributes.email_verified;

                    async.series([
                        function (cb) {
                            if (userAttributes.name) {
                                cb();
                            } else {
                                getResponse('Enter your name: ', cb);
                            }
                        },
                        function (cb) {
                            // Get these details and call
                            getResponse('A new password is required, enter it now: ', cb);
                        }
                    ], function (err, results) {
                        let name = results[0];
                        if (name) {
                            userAttributes.name = name;
                        }
                        let newPassword = results[1];
                        cognitoUser.completeNewPasswordChallenge(newPassword, userAttributes, self);
                    });

                }
            }
        );
    }
    forgot(username, cb) {
        var cognitoUser = this.getCognitoUser(username);
        cognitoUser.forgotPassword({
            onSuccess: function (data) {
                // successfully initiated reset password request
        	console.log('CodeDeliveryData from forgotPassword: ' + data);
            },
            onFailure: function(err) {
                console.error(err);
            },
            //Optional automatic callback
            inputVerificationCode: function(data) {
                let self = this;
                console.log('Code sent to: ' + data);
                async.series([
                    function (cb) {
                        getResponse('Please input verification code: ', cb);
                    },
                    function (cb) {
                        getResponse('Enter new password: ', cb);
                    }
                ], function (err, results) {
                    let verificationCode = results[0];
                    let newPassword = results[1];
                    cognitoUser.confirmPassword(verificationCode, newPassword, self);
                });
            }        
        });
    }
}

function getResponse(prompt, cb) {
    process.stdout.write(prompt);
    process.stdin.once('data', function (data) {
        cb(null, data.trim());
    });
}

class NotesCaller {
    call(host, token, callback) {
        var options = {
            method: 'GET',
            host: host,
            path: '/prod/notes',
            headers: {'Authorization': token}
        };
        var request = https.request(options, collecter(callback));
        request.end();
    }
}

function collecter(callback) {
    return function(result) {
        function onceCollected(err, data) {
            var string = data.toString();
            callback(string);
        }
        result.setEncoding('utf8');
        result.pipe(bl(onceCollected));
        result.on('error', (err) => console.error(err));
    }
}

let okay = true;
[
    'COGNITO_POOL_ID',
    'COGNITO_CLIENT_ID',
    'COGNITO_USERNAME',
    'COGNITO_PASSWORD',
    'NOTES_HOST'
].forEach(function (key) {
    if (!process.env[key]) {
        console.error(`You must set the ${key} env var`);
        okay = false;
    }
});
if (!okay) {
    process.exit(1);
}

var loginer = new Loginer(process.env['COGNITO_POOL_ID'], process.env['COGNITO_CLIENT_ID']);

/*
loginer.forgot(process.env['COGNITO_USERNAME'], function(result) {
    console.log('result:', result);
});
*/

loginer.login(process.env['COGNITO_USERNAME'], process.env['COGNITO_PASSWORD'], function(result) {
    //console.log('result:', result);
    var idToken = result.idToken.jwtToken;
    new NotesCaller().call(process.env['NOTES_HOST'], idToken, console.log);
});
