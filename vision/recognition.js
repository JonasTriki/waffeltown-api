const KEY = "AIzaSyC7mzvLLsw5CY1ahiWX3mukA7DbxO_Elmk";
const BASE_URL = "https://vision.googleapis.com/v1/images:annotate?key=";
const request = require("request");

exports.recognizeWaffel = function(base64, cb) {
    var opts = {
        uri: BASE_URL + KEY,
        method: "POST",
        json: {
            requests: [{
                image: {
                    content: base64
                },
                features: [{
                    type: "LABEL_DETECTION"
                }]
            }]
        }
    };
    request(opts, (err, resp, body) => {
        if (err) {
            console.log(err);
            cb(err);
            return;
        }
        if (resp.statusCode == 200) {

            // Check if we have any responses with "waffle" in the desc.
            var isWaffel = false;
            console.log(body.responses[0]);
            for (var i = 0; i < body.responses[0].labelAnnotations.length; i++) {
                var desc = body.responses[0].labelAnnotations[i].description;
                if (desc.indexOf("waffle") > -1) {
                    isWaffel = true;
                    break;
                }
            }
            cb({isWaffel: isWaffel});
        }
    });
}
