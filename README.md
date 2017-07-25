# lambda-cognito

This is my simple experiment to put Cognito in front of a lambda function.

I started off following [this article](http://blog.cacoveanu.com/2017/03/17/amazon-api-gateway.html), but broke off once it got into "Getting more details about the identity using a custom authorizer".

All the callback code is horrible, I feel dirty.

[This article](https://aws.amazon.com/blogs/compute/authorizing-access-through-a-proxy-resource-to-amazon-api-gateway-and-aws-lambda-using-amazon-cognito-user-pools/) had the most up to date information regarding:

> Since then, we’ve released a new feature where you can directly configure a Cognito user pool authorizer to authenticate your API calls; more recently, we released a new proxy resource feature.
