/**
 * Created by Greyson on 5/12/16.
 */

//Get access to the Twit API and bind to a variable
var Twit = require('twit');

//Get access to the Firebase API and bind to a variable
var Firebase = require('firebase');

//Save previously parsed tweets to avoid accidental repeats
var tweets = [];

//Create a new instance of the Twit API using Twitter authorization keys
var T = new Twit({
    consumer_key: 'IFDq2K0W70QGp3mHzgzm6sGkh',
    consumer_secret: 'tziiLdxQ4qsAhwD5cb8beFOvZOyUHugWfOHTCcQDMQng3KUb3E',
    access_token: '730784674608517120-mDi6dicfsDZSzyyZp68EyJWGWXaehP7',
    access_token_secret: 'Q7QzaFGIXOZWEe3NkBiptbXstafKFmppItZYizC92oHNX',
    timeout_ms: 60 * 1000
});

//Create a new instance of the Firebase API
var users = new Firebase('http://magiccitycoders-c.firebaseio.com/users');

//Store access to Streaming API with specific filter parameters
var stream = T.stream('statuses/filter', {track: '@Churp_Me'});

//Event called when connected to the stream
stream.on('connected', function (response) {
    console.log("Connected to Twitter!");
});

//Event called when a new tweet enters the stream
stream.on('tweet', function (tweet) {
    if (tweet.in_reply_to_screen_name != 'Churp_Me') {
        return;
    }
    var message = tweet.text;
    var args = message.split(" ");
    var response;

    //Validate the formatting of the tweet
    if (args.length < 3) {
        response = "Error! Invalid number of arguments. IGNORE";
    }
    else if (!args[1].startsWith("@")) {
        response = "Error! Invalid recipient formatting. IGNORE";
    }
    else if (!args[2].startsWith("$")) {
        response = "Error! Invalid amount formatting. IGNORE";
    }
    else if (isNaN(+args[2].replace("$", ""))) {
        response = "Are you trying to use Churp? If so, please make sure your dollar amount is in the right format ($15/$15.00)";
    } else {
        userExists(tweet.user.screen_name).then(function (success) {
            if (!success) {
                response = "Are you trying to use Churp? If so, you must first create an account on our website http://churp.me";
            }
            else {
                userExists(args[1].replace("@", "")).then(function (success) {
                    if (!success) {
                        response = "Sorry, we could not find a Churp account linked to that user name. If you think this is an error, please let us know";
                    } else {
                        !hasBalance(tweet.user.screen_name, +args[2].replace("$", "")).then(function (success) {
                            if (!success) {
                                response = "Sorry, but you do not appear to have sufficient funds to send this Churp";
                            }
                            else {
                                hasBalance(args[1].replace("@", ""), +args[2].replace("$", "")).then(function (success) {
                                    if (!success) {
                                        response = "Sorry, but it appears that recipient has not yet linked a payment account to their Churp account";
                                    }
                                    else {
                                        response = "Success! Your Churp for " + args[2] + " has been sent to " + args[1];
                                    }
                                })
                            }
                        });
                    }
                })
            }
        })
    }

    //After 5 seconds check the response and reply if the response is not to be ignored
    setTimeout(function () {
        console.log("RESPONSE: " + response);
        if (response != null && !response.endsWith("IGNORE")) {
            T.post('statuses/update', {
                status: "@" + tweet.user.screen_name + " " + response,
                in_reply_to_status_id: tweet.id_str
            }, function (err, data, response) {
            })
        }
    }, 5 * 1000);

});

//Check to see if a specified username exists in the Firebase databse
function userExists(username) {
    return users.once('value').then(function (success) {
        return success.hasChild(username);
    });
}

//Check to see if a specific user has a specified balance
function hasBalance(username, balance) {
    return users.child(username).once('value').then(function (success) {
        return success.hasChild('payment/balance') && success.child('payment/balance').val() >= balance;
    });
}