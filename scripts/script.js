var searchHistory = [];

var canvas;
var ctx;

var mouseX = 0;
var mouseY = 0;

var centerX;
var centerY;

var radius;

var tweets = [];

var state = 0;
var tweetOpacity = 0;

var blurbCutoff = 70;

var themeColor = "255, 255, 255";

var loopDelay = 20;
var tweetDelay = 1000;

var resizeDelay = 250;
var resizeTimerID;

var fps = 0;
var now, lastUpdate = Date.now();
var fpsFilter = 20;

function Tweet(data, max, min) {
    function red(x) {
        if (x < 0.412) {
            return 0;
        } else if (x < 0.638) {
            return 4.425 * x - 1.823;
        } else if (x < 0.864) {
            return 1;
        } else {
            return -4.425 * x + 4.823;
        }
    }
    function green(x) {
        if (x < 0.151) {
            return 0;
        } else if (x < 0.387) {
            return 4.425 * x - .712;
        } else if (x < 0.613) {
            return 1;
        } else if (x < 0.839) {
            return -4.425 * x + 3.712;
        } else {
            return 0;
        }
    }
    function blue(x) {
        if (x < 0.136) {
            return 4.425 * x + 0.398;
        } else if (x < 0.362) {
            return 1;
        } else if (x < 0.588) {
            return -4.425 * x + 2.602;
        } else {
            return 0;
        }
    }  
    this.data = data;
    this.r = function() {
        return (this.z + radius) / (radius / 8) + 8;
    }
    var x = (Date.parse(data.created_at) - min) / (max - min);
    this.color = Math.floor(red(x) * 255) + "," + Math.floor(green(x) * 255) + "," + Math.floor(blue(x) * 255);
};

Tweet.prototype.data = null;
Tweet.prototype.timer = null;
Tweet.prototype.x = 0;
Tweet.prototype.y = 0;
Tweet.prototype.z = 0;
Tweet.prototype.color = "0, 0, 0";

$(document).ready(function() {
    canvas = document.getElementById("canvas");
    if (!canvas.getContext) {
        $("#results").html("<h1>Please download a better browser: <a href='http://getfirefox.com'>FireFox</a>, <a href='http://apple.com/safari'>Safari</a>, <a href='http://www.opera.com/'>Opera</a> or <a href='http://google.com/chrome'>Chrome</a> </h1>");
    } else {

        var fpsOut = $("#fps");
        setInterval(function() {
            fpsOut.html(fps.toFixed(1) + "fps");
        }, 1000); 
    
        centerX = window.innerWidth * 2 / 3;
        centerY = window.innerHeight / 2;
    
        radius = Math.min(256, centerY * .9);
    
        setup();
    
    
        $(window).bind("resize", function(e) {
            clearTimeout(resizeTimerID);
            resizeTimerID = setTimeout(function() {
                centerX = window.innerWidth * 2 / 3;
                centerY = window.innerHeight / 2;
                radius = Math.min(256, centerY * .9);
            }, resizeDelay);
        });
    
        $(document).bind("mousemove", function(e) {    
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
    
        $(document).bind("click", function(e) {
            displayTweet(findTweet());
        });
    
        $("#search").bind("submit", function(e) {
            var search = $("#search input").val().trim();
            ajaxSearch(e, search);
        });
    
        $("#back").bind("click", function(e) {
            back(e);
        });
        
        $("#back").mouseenter(function(e) {
            $(this).children().css("color", "rgb(" + themeColor + ")");
        }).mouseleave(function(e) {
            $(this).children().css("color", "rgb(255, 255, 255)");
        });
        
        loop();
    }
});

function setup() {
    ctx = canvas.getContext("2d");
    ctx.canvas.width  = window.innerWidth;
    ctx.canvas.height = window.innerHeight;
}

function ajaxSearch(event, search) {
    event.preventDefault();
    if (search === "") {
        return false;
    }
    if (state === 2) {
        state = 3;
    }
    $("#search :input").val(search);
    $("#bigtweet").html("");
    if (searchHistory[searchHistory.length - 1] !== search) {
        searchHistory.push(search);
    }
    $("#status").html("Searching for '" + search + "'...");
    $.ajax({
        url: 'http://search.twitter.com/search.json',
        data: {
            "rpp":"100",
            "result_type":"recent",
            "lang":"en",
            "q":search
        },
        dataType: 'jsonp',
        beforeSend: function() {
            $("#status").html("Searching...");
        },
        success: function(data) {
            if (data.results.length == 0) {
                $("#status").html("No results for '" + search + "'.");
                tweets.length = 0;
            } else {
                $("#status").html("Showing " + data.results.length + " tweets that match '" + search + "'.");
                populateTweets(data.results);
            }
		},
        error: function() {
            $("#status").html("An error occurred.");
        }
    });
}

function populateTweets(resultsArray) {
    if (state === 0) {
        $("#results").html("");
        tweets.length = 0;
        var max = Date.parse(resultsArray[0].created_at);
        var min = max;
        for (var i = 1; i < resultsArray.length; i++) {
            max = Math.max(max, Date.parse(resultsArray[i].created_at));
            min = Math.min(min, Date.parse(resultsArray[i].created_at));
        }
        for (var i = 0; i < resultsArray.length; i++) {
            var phi = Math.acos(-1 + (2 * i) / resultsArray.length);
            var theta = Math.sqrt(resultsArray.length * Math.PI) * phi;
            var x = radius * Math.cos(theta) * Math.sin(phi);
            var y = radius * Math.sin(theta) * Math.sin(phi);
            var z = radius * Math.cos(phi);
            var tweet = new Tweet(resultsArray[i], max, min);
            tweet.x = x;
            tweet.y = y;
            tweet.z = z;
            tweets.push(tweet);
        }
        state = 1;
    } else {
        setTimeout(function() {
            populateTweets(resultsArray);
        }, 100);
    }
}

function formatTweet(tweet) {
    var text = tweet.data.text;
    text = text.replace(/http:\/\/(\S+)/g, "<a href=\"http://$1\" style='color: rgb(" + tweet.color + ");'>http://$1</a>");
    text = text.replace(/@(\w+)([^\w\s]?)/g, "<a href='http://twitter.com/$1\' style='color: rgb(" + tweet.color + ");'>@$1</a>$2");
    text = text.replace(/#(\w+)([^\w\s]?)/g, "<a href='' class='hash' style='color: rgb(" + tweet.color + ");'>#$1</a>$2");
    return "<div class='text'>" + text + "</div><div class='user'><img src='" + tweet.data.profile_image_url + "' width='48' height='48' /><a href='http://twitter.com/" + tweet.data.from_user + "' style='color: rgb(" + tweet.color + ");'>" + tweet.data.from_user + "</a></div><div id='source'>via " + $("<div />").html(tweet.data.source).text() + "</div>";
}

function formatBlurb(tweet) {
    var text = tweet.data.text;
    if (text.length >= blurbCutoff) {
        text = text.substring(0, blurbCutoff) + "...";
    }
    return tweet.data.from_user + ": \"" + text + "\" about " + timePassed(Date.parse(tweet.data.created_at)) + " ago.";
}

function findTweet() {
    for (var i = 0; i < tweets.length; i++) {
        var x = tweets[i].x;
        var y = tweets[i].y;
        var z = tweets[i].z;
        var r = tweets[i].r();
        if (mouseX > centerX + x - r && mouseX < centerX + x + r && mouseY > centerY + y - r && mouseY < centerY + y + r) {
            return tweets[i];
        }
    }
    return null;
}

function displayTweet(tweet) {
    if (tweet == null) {
        return;
    }
    themeColor = tweet.color;
    $("#search input[type='textarea']").css("border-color", "rgb(" + tweet.color + ")");
    $("#bigtweet").html(formatTweet(tweet));
    $(".hash").each(function() {
        $(this).bind("click", function(e) {
            e.preventDefault();
            ajaxSearch(e, $(this).text());
        });
    });
    $("#source").mouseenter(function(e) {
        $(this).children().css("color", "rgb(" + themeColor + ")");
    }).mouseleave(function(e) {
        $(this).children().css("color", "rgb(255, 255, 255)");
    });
}

function showTweet(tweet) {
    if (tweet == null) {
        return;
    }
    if ($("#t" + tweet.data.id).length) {
        clearTimeout(tweet.timer);
    } else {
        $("#results").append("<span id='t" + tweet.data.id + "'><div class='tweet-caret triangle-border-left-before' style='top: " + (centerY + tweet.y - 45 + 31) + "px; left:" + (centerX + tweet.x) + "px; border-color: transparent rgb(" + tweet.color + ")'></div><div class='tweet triangle-border' style='top: " + (centerY + tweet.y - 45) + "px; left:" + (centerX + tweet.x + 25) + "px; border-color: rgb(" + tweet.color + ")'>" + formatBlurb(tweet) + "</div></span>");
    }
    tweet.timer = setTimeout(function() {
        hideTweet(tweet);
    }, tweetDelay);
}

function hideTweet(tweet) {
    var r = tweet.r();
    if (mouseX > centerX + tweet.x - r && mouseX < centerX + tweet.x + r && mouseY > centerY + tweet.y - r && mouseY < centerY + tweet.y + r) {
        clearTimeout(tweet.timer);
        hideTweet(tweet);
    } else {
        $("#t" + tweet.data.id).children().fadeOut(400, function() {
            $("#t" + tweet.data.id).remove();
        });
    }
}

function timePassed(milliseconds) {
    var secondsPassed = (Date.now() - milliseconds) / 1000;
    var time;
    var timeString;
    if (secondsPassed < 60) {
        time = Math.floor(secondsPassed);
        timeString = "second";
    } else if (secondsPassed < 60 * 60) {
        time = Math.floor(secondsPassed / 60);
        timeString = "minute";
    } else if (secondsPassed < 60 * 60 * 24) {
        time = Math.floor(secondsPassed / (60 * 60));
        timeString = "hour";
    } else {
        time = Math.floor(secondsPassed / (60 * 60 * 24));
        timeString = "day";
    }
    if (time === 1) {
        return time + " " + timeString;
    } else {
        return time + " " + timeString + "s";
    }
}

function back(event) {
    event.preventDefault();
    if (searchHistory.length > 1) {
        searchHistory.pop()
        ajaxSearch(event, searchHistory[searchHistory.length - 1]);
    }
}

function loop() {
    setTimeout(function() {
        showTweet(findTweet());
        
        var MX = Matrix.RotationX(-(mouseY - centerY) * 0.00005);
        var MY = Matrix.RotationY((mouseX - centerX) * 0.00005);
        for (var i = 0; i < tweets.length; i++) {
            var M1 = $M([[tweets[i].x, tweets[i].y, tweets[i].z]]);
            var M = M1.x(MX);
            var M = M.x(MY);
            tweets[i].x = M.e(1,1);
            tweets[i].y = M.e(1,2);
            tweets[i].z = M.e(1,3);
        }
        draw();
        loop();
    }, loopDelay);    
}

function draw() {
    // for measuring fps
    var thisFrameFPS = 1000 / ((now = Date.now()) - lastUpdate);
    fps += (thisFrameFPS - fps) / fpsFilter;
    lastUpdate = now;
  
    if (state === 1) {
        if (tweetOpacity >= .8) {
            state = 2;
        } else {
            tweetOpacity += .03;
        }
    } else if (state === 3) {
        if (tweetOpacity <= 0) {
            state = 0;
        } else {
            tweetOpacity -= .03;
        }
    }
    
    ctx.globalCompositeOperation = "source-over";
    //ctx.fillStyle = "rgba(8,8,12,.65)";
    ctx.fillStyle = "rgb(0, 0, 0)";
	ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < tweets.length; i++) {
        var x = tweets[i].x;
        var y = tweets[i].y;
        var z = tweets[i].z;
        var r = tweets[i].r();
        ctx.fillStyle = "rgba(" + tweets[i].color + ", " + tweetOpacity + ")";
        ctx.beginPath();
		ctx.arc(centerX + x, centerY + y, r, 0 , Math.PI * 2, false);
		ctx.closePath();
		ctx.fill();
        var tweet = $("#t" + tweets[i].data.id);
        if (tweet.length) {
            tweet.children(".tweet").css("top", (centerY + y - 45) + "px").css("left", (centerX + x + 25) + "px");
            tweet.children(".tweet-caret").css("top", (centerY + y - 45 + 31) + "px").css("left", (centerX + x + 25 - 25) + "px");
        }
    }
}