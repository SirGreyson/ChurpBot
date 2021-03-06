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
    consumer_key: 'jPwTRyJNQtixYZk4BvtLs4x0m',
    consumer_secret: 'ug5R83BByzrv3HOCvygDQ5k2wAUHaMX0QrtpYIpXdNX4wKuVx3',
    access_token: '730784674608517120-BTtgQe9anSKj8ZgtVtJ4LP57uzSnyY5',
    access_token_secret: 'iM1eafsmedqwpMecdXi0EkkDyrr9i5xrUewD7QIoo0qyJ',
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
    //Is the second argument a username?
    else if (!args[1].startsWith("@")) {
        response = "Error! Invalid recipient formatting. IGNORE";
    }
    //Is the third argument a number?
    else if (isNaN(+args[2].replace("$", ""))) {
        response = "Are you trying to use Churp? If so, please make sure your dollar amount is in the right format (IE. $15/$15.00)";
    }
    //Does the third argument have the proper money formatting?
    else if (!args[2].startsWith("$")) {
        response = "Are you trying to use Churp? If so, please make sure your dollar amount is in the right format (IE. $15/$15.00)";
    } else {
        //Does the user sending the Churp have an account on churp.me?
        userExists(tweet.user.screen_name).then(function (success) {
            if (!success) {
                response = "Are you trying to use Churp? If so, you must first create an account on our website http://churp.me";
            }
            else {
                //Does the user receiving the Churp have an account on churp.me?
                userExists(args[1].replace("@", "")).then(function (success) {
                    if (!success) {
                        response = "Sorry, we could not find a Churp account linked to that user name. If you think this is an error, please let us know";
                    } else {
                        getBalance(tweet.user.screen_name).then(function (fBal) {
                            //Does the user sending the Churp have a linked payment account with a sufficient balance?
                            if (fBal <= 0 || +args[2].replace("$", "") > fBal) {
                                response = "Sorry, but you do not appear to have sufficient funds to send this Churp";
                            } else {
                                getBalance(args[1].replace("@", "")).then(function (tBal) {
                                    //Does the user receiving the Churp have a linked payment account?
                                    if (tBal <= 0) {
                                        response = "Sorry, but it appears that recipient has not yet linked a payment account to their Churp account";
                                    } else {
                                        //Get the specified campaign if the user has specified one
                                        var campaign = args.length > 3 && args[3].startsWith("#") ? args[3].replace("#", "") : null;
                                        //If all of the above are false, send the Churp and transfer the money
                                        response = "Success! Your Churp for " + args[2] + " has been sent to " + args[1];
                                        doTransfer(tweet.user.screen_name, args[1].replace("@", ""), fBal, tBal, +args[2].replace("$", ""), null);
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
        //Does the response have an IGNORE tag?
        if (response != null && !response.endsWith("IGNORE")) {
            //If the response is not ignored, post the response in reply to the initial tweet
            T.post('statuses/update', {
                status: "@" + tweet.user.screen_name + " " + response,
                in_reply_to_status_id: tweet.id_str
            }, function (err, data, response) {
                if (err != null) {
                    console.log(err);
                }
            })
        }
    }, 5 * 1000);

});

//Check to see if a specified username exists in the Firebase database
function userExists(username) {
    return users.once('value').then(function (snapshot) {
        return snapshot.hasChild(username);
    });
}

//Get the balance of a specified username from the Firebase database
function getBalance(username) {
    return users.child(username).once('value').then(function (snapshot) {
        return snapshot.hasChild('payment/balance') ? snapshot.child('payment/balance').val() : -1;
    })
}

//Get a specified user's campaign with a given hashtag if it exists
function getCampaign(username, hashtag) {
    return users.child(username).once('value').then(function (snapshot) {
        var output;
        if (!snapshot.hasChild('campaigns')) {
            output = null;
        }
        var campaigns = snapshot.child('campaigns');
        campaigns.forEach(function (child) {
            if (child.child('hashtag').val() == hashtag) {
                output = child;
            }
        });
        return output;
    });
}

function getProfileImage(username) {
    T.get('users/lookup', {screen_name: username}, function (err, data, response) {
        return data[0].profile_image_url.substr(36);
    })
}

//Transfer a specified amount of money from one Churp account to another
function doTransfer(from, to, fBal, tBal, amount, campaign) {
    console.log("From: " + from + " > " + fBal + " for " + campaign);
    console.log("To: " + to + " > " + tBal);
    if (campaign != null) {
        getCampaign(to, campaign).then(function (success) {
            if (success != null) {
                success.child('transactions').push({
                    amount: amount,
                    favorites: 0,
                    picture: 'PLACE-HOLDER',
                    retweets: 0,
                    username: from
                });
            }
        });
    }
    users.child(from + '/payment').update({balance: (fBal - amount).toFixed(2)});
    users.child(to + '/payment').update({balance: (tBal + amount).toFixed(2)});
}