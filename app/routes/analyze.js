/*-------------------------------------------------------------------*/
/*                                                                   */
/* Copyright IBM Corp. 2013 All Rights Reserved                      */
/*                                                                   */
/*-------------------------------------------------------------------*/
/*                                                                   */
/*        NOTICE TO USERS OF THE SOURCE CODE EXAMPLES                */
/*                                                                   */
/* The source code examples provided by IBM are only intended to     */
/* assist in the development of a working software program.          */
/*                                                                   */
/* International Business Machines Corporation provides the source   */
/* code examples, both individually and as one or more groups,       */
/* "as is" without warranty of any kind, either expressed or         */
/* implied, including, but not limited to the warranty of            */
/* non-infringement and the implied warranties of merchantability    */
/* and fitness for a particular purpose. The entire risk             */
/* as to the quality and performance of the source code              */
/* examples, both individually and as one or more groups, is with    */
/* you. Should any part of the source code examples prove defective, */
/* you (and not IBM or an authorized dealer) assume the entire cost  */
/* of all necessary servicing, repair or correction.                 */
/*                                                                   */
/* IBM does not warrant that the contents of the source code         */
/* examples, whether individually or as one or more groups, will     */
/* meet your requirements or that the source code examples are       */
/* error-free.                                                       */
/*                                                                   */
/* IBM may make improvements and/or changes in the source code       */
/* examples at any time.                                             */
/*                                                                   */
/* Changes may be made periodically to the information in the        */
/* source code examples; these changes may be reported, for the      */
/* sample code included herein, in new editions of the examples.     */
/*                                                                   */
/* References in the source code examples to IBM products, programs, */
/* or services do not imply that IBM intends to make these           */
/* available in all countries in which IBM operates. Any reference   */
/* to the IBM licensed program in the source code examples is not    */
/* intended to state or imply that IBM's licensed program must be    */
/* used. Any functionally equivalent program may be used.            */
/*-------------------------------------------------------------------*/


var _ = require('underscore');
var request = require('request');
var twitter = require('../lib/twitter')

exports.get = function (req, res) {
// query twitter search API to get recent tweets related to specified keyword
//  then send tweets through either the Name or Company Text analytics service. 
//  once analytic service processes the tweets, do a count of the number of mentions of specific
//  companies or names and return JSON with that information

  // get twitter results
	twitter.getResults(req.params.keyword, 100, 'recent', function (err, tweets) {
    if (err) {
      console.log(err);
      return res.json(err);
    }

    // store tweet text in form of array to be sent to 
    //  text analytics service.
    var messages = tweets.statuses;
    var texts = new Array();
    console.log("Messages:");
    messages.forEach(function (msg) {
      console.log(JSON.stringify(msg.text));
      texts.push(JSON.stringify(msg.text));
    });

    // check requested type of analytics to be done
    var annotationType;

    if(req.params.option == 'companies'){
      annotationType=['com.ibm.langware.en.Company'];
    }
    else if(req.params.option == 'people'){
      annotationType=['com.ibm.langware.en.Person'];
    }

    var data = {
      'texts': texts, 
      'annotations': annotationType
    };


    // extract company names or people names from tweets
    extractNames(req.params.option, data, function (err, response) {
      if (err) return res.json(err);

      countMentions(response, function (err, result) {
        if (err) return res.json(err);
        console.log("RETURNED JSON: " + JSON.stringify(result));
        res.json(result);
      });
    });
  });
};

function extractNames(type, data, cb) {
// query proper anayltics service to extract company or people names from supplied tweets


  // choose correct analytics service to hit
  var url = app.get('company_analytics_url') ? app.get('company_analytics_url') : 'http://companiestextanalyticsserviceapplication.w3.bluemix.net/rest/service/analyze'; /*app.get('analytics_url')*/;
  
  if(type == 'people'){
    url = app.get('name_analytics_url') ? app.get('name_analytics_url') : 'http://namestextanalyticsserviceapplication.w3.bluemix.net/rest/service/analyze';
  }

  var options = {
    url: url,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: data
  };

  // post to analytics service
  request.post(options, function (err, response, body) {
    if (err) {
      console.log('Error extracting companies: ' + err); 
      return cb(err);
    }

    if (response.statusCode != 200) {
      return cb({ error: 'Status code: ' + response.statusCode });
    }

    return cb(null, response);
  });
}


function countMentions(response, cb) {
// count number of mentions of company names after returned by IBM Text Analytics service

  var tweets = response.body;   // tweets marked up with analytics metadata
  var histogram = new Object(); // used to count occurrences of company or people name

  // iterate through each tweet to count number of mentions of names contained within all of the tweets
  tweets.forEach(function (tweet) {
    var analyzed = tweet.analyticsResults[0].annotations;

    analyzed.forEach(function (result) {
      var name = result['covered-text'].toLowerCase();
      histogram[name] = histogram[name] == null ?  1 : histogram[name] + 1;
    });
  });

  console.log('Names: ' + _.keys(histogram));
  console.log('# of Mentions: ' + _.values(histogram));

  cb(null, {
    labels: _.keys(histogram), 
    response: _.values(histogram)
  });
}