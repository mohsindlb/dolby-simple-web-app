const logMessage = (message) => {
    console.log(`${new Date().toISOString()} - ${message}`);
    $('#logs-area').val((_, text) => `${text}${new Date().toISOString()} - ${message}\r\n` );

    // Scroll to the end
    $('#logs-area').scrollTop($('#logs-area')[0].scrollHeight);
};

const logError = (message) => {
    console.error(`${new Date().toISOString()} - ${message}`);
    $('#logs-area').val((_, text) => `${text}${new Date().toISOString()} - ${message}\r\n` );

    // Scroll to the end
    $('#logs-area').scrollTop($('#logs-area')[0].scrollHeight);
};


// Do not configure your appKey and appSecret in this application,
// you must use your server for authentication purpose 
// Please refer to this link https://docs.dolby.io/communications-apis/docs/guides-client-authentication 
const appKey = '';//""; 
const appSecret ='';// "";
let conference = null;


// const authUrl = 'https://events-demo.netlify.app/.netlify/functions/client-access-token';
const authUrl = 'https://test-dolbyio.netlify.app/.netlify/functions/token-service';
/**
 * Initialize the SDK with a client access token
 */

$("#initialize-btn").click(async() => {
    // const accessToken = $('#access-token-input').val();
    logMessage('Getting access token');

    const url = authUrl;
    $.ajax({
        async : true,
        type: "POST",
        url: url,
        contentType: "application/json",
        
    }).done(function (response) {
        console.log('Resp: ' + JSON.stringify(response));
        // conference = response;
        logMessage('Access token received!')
        let jsonResponse = JSON.parse(response)
        $('#access-token-input').val(jsonResponse.access_token);
        initializeSDK(jsonResponse.access_token);

    }).fail(function (err) {
        logError(err);
    });

});



const initializeSDK = (accessToken) => {
    const token = accessToken.split('.')[1];
    const jwt = JSON.parse(window.atob(token));
    accessTokenExpiration = new Date(jwt.exp * 1000);
    if (accessTokenExpiration.getTime() <= new Date().getTime()) {
        logError('The access token you have provided has expired.');
        return;
    }

    logMessage(`Initialize the SDK with the Access Token: ${accessToken}`);
    logMessage(`Access Token Expiration: ${accessTokenExpiration}`);

    VoxeetSDK.initializeToken(accessToken, () => new Promise((resolve) => resolve(accessToken)));

    $('#initialize-btn').attr('disabled', true);
    $('#connect-btn').attr('disabled', false);
    loadImage();
};

var conferenceId;
var conferenceAccessToken;

const getConstraints = (joinWithAudio, joinWithVideo) => {
    if (!joinWithVideo) {
        return {
            constraints: {
                audio: joinWithAudio,
                video: joinWithVideo
            }
        };
    }

    let video = true;

    let value = $('#webrtc-constraints').val();
    if (value === "640") {
        video = { width: 640, height: 360 };
    } else if (value === "960") {
        video = { width: 960, height: 540 };
    } else if (value === "1280") {
        video = { width: 1280, height: 720 };
    } else if (value === "min640") {
        video = { width: { min: 640 }, height: { min: 360 } };
    } else if (value === "min960") {
        video = { width: { min: 960 }, height: { min: 540 } };
    } else if (value === "min1280") {
        video = { width: { min: 1280 }, height: { min: 720 } };
    }

    return {
        constraints: {
            audio: joinWithAudio,
            video: video
        }
    };
};

$('#btn-set-webrtc-constraints').click(() => {
    VoxeetSDK.session.participant.streams.forEach(stream => {
        if (stream.active && stream.type === "Camera") {
            logMessage("VoxeetSDK.conference.stopVideo");

            // Stop the video and restart it with the new constraints
            VoxeetSDK.conference
                .stopVideo(VoxeetSDK.session.participant)
                .then(startVideo)
                .catch((err) => logError(err));
            return;
        }
    });
});

$('#connect-btn').click(() => {
    const externalId = $('#external-id-input').val();
    const username = $('#username-input').val();
    const avatarUrl = $('#avatar-url-input').val();
  
    // Open a session to the Dolby.io APIs
    VoxeetSDK.session
        .open({ name: username, externalId: externalId, avatarUrl: avatarUrl })
        .then(() => {
            // Update the login message with the name of the user
            $('#title').text(`You are connected as ${username}`);
            $('#conference-join-btn').attr('disabled', false);
            $('#conference-listen-btn').attr('disabled', false);
            $('#connect-btn').attr('disabled', true);
            $('#external-id-input').attr('readonly', true);
            $('#username-input').attr('readonly', true);
            $('#avatar-url-input').attr('readonly', true);
        })
        .then(() => logMessage(`You are connected as ${username}`))
        .catch((e) => logError(e));
});

function setDevices(name, listSelector, btnSelector, devices) {
    console.log(name);
    console.log(devices);
    $(listSelector).empty();

    devices.forEach(device => {
        $(listSelector).append(new Option(device.label, device.deviceId));
    });

    $(btnSelector).attr('disabled', false);
}

$('#conference-join-btn').click(async () => {
    try {
        const liveRecording = $('#chk-live-recording')[0].checked;
        const joinWithAudio = $('#chk-join-with-audio')[0].checked;
        const joinWithVideo = $('#chk-join-with-video')[0].checked;

        // Default conference parameters
        // See: https://docs.dolby.io/communications-apis/docs/js-client-sdk-model-conferenceparameters
        const conferenceParams = {
            liveRecording: liveRecording,
            rtcpMode: "average", // worst, average, max
            ttl: 0,
            videoCodec: "VP8", // H264, VP8
            dolbyVoice: true
        };

        // See: https://docs.dolby.io/communications-apis/docs/js-client-sdk-model-conferenceoptions
        const conferenceOptions = {
            alias: $('#conference-alias-input').val(),
            params: conferenceParams
        };

        // 1. Create a conference room with an alias
        const conference = await VoxeetSDK.conference.create(conferenceOptions);

        logMessage(`Conference id: ${conference.id} & Conference alias ${conference.alias}`);
        conferenceId = conference.id;

        // See: https://docs.dolby.io/communications-apis/docs/js-client-sdk-model-joinoptions
        const joinOptions = getConstraints(joinWithAudio, joinWithVideo);
        joinOptions.simulcast = true;
        if (conferenceAccessToken) {
            joinOptions.conferenceAccessToken = conferenceAccessToken;
            joinOptions.spatialAudio = true;
        }

        logMessage("Join the conference with the options:");
        logMessage(JSON.stringify(joinOptions));

        // 2. Join the conference
        await VoxeetSDK.conference.join(conference, joinOptions);



        // Subscribe to the participant joined/left events
        await VoxeetSDK.notification.subscribe([
            {
                type: "Participant.Left",
                conferenceAlias: conference.alias
            },
            {
                type: "Participant.Joined",
                conferenceAlias: conference.alias
            },
            {
                type: "Conference.ActiveParticipants",
                conferenceAlias: conference.alias
            }
        ]);

        // Subscribes to the conference.Created and conference.Ended events
        await VoxeetSDK.notification.subscribe([
            {
                type: "Conference.Created",
                conferenceAlias: conference.alias
            },
            {
                type: "Conference.Ended",
                conferenceAlias: conference.alias
            },
        ]);

        setInterval(() => {
            let participants = VoxeetSDK.conference.participants;
      
            for (let participant of participants) {
              VoxeetSDK.conference.isSpeaking(
                VoxeetSDK.conference.participants.get(participant[0]),
                (isSpeaking) => {
                //   console.log('The participant', participant[1].info.name, 'speaking status:', isSpeaking);
                  if (isSpeaking) {
                    // participant is speaking, update UI accordingly 
                  } else if (!isSpeaking) {
                    // participant is not speaking, update UI accordingly 
                  }
                }
              );
            }
          }, 500);

        // Load the Output Audio devices
        let devices = await VoxeetSDK.mediaDevice.enumerateAudioDevices("output");
        setDevices('Output Audio Devices', '#output-audio-devices', '#btn-set-output-audio-device', devices);

        // Load the Input Audio devices
        devices = await VoxeetSDK.mediaDevice.enumerateAudioDevices("input");
        setDevices('Input Audio Devices', '#input-audio-devices', '#btn-set-input-audio-device', devices);

        // Load the Video devices
        devices = await VoxeetSDK.mediaDevice.enumerateVideoDevices("input");
        setDevices('Video Devices', '#video-devices', '#btn-set-video-device', devices);

        $('#btn-set-webrtc-constraints').attr('disabled', false);

        $('#chk-live-recording').attr('disabled', true);
        $('#conference-join-btn').attr('disabled', true);
        $('#conference-listen-btn').attr('disabled', true);
        $('#conference-leave-btn').attr('disabled', false);
        $('#conference-alias-input').attr('readonly', true);

        $('#start-video-btn').attr('disabled', joinWithVideo);
        $('#stop-video-btn').attr('disabled', !joinWithVideo);
        $('#start-bokeh-btn').attr('disabled', !joinWithVideo);
        $('#start-bgimg-btn').attr('disabled', !joinWithVideo);

        $('#start-audio-btn').attr('disabled', joinWithAudio);
        $('#stop-audio-btn').attr('disabled', !joinWithAudio);
        $('#mute-audio-btn').attr('disabled', !joinWithAudio);
        $('#unmute-audio-btn').attr('disabled', joinWithAudio);

        $('#start-screenshare-btn').attr('disabled', false);
        $('#stop-screenshare-btn').attr('disabled', true);

        $('#video-url-input').attr('readonly', false);
        $("#video-start-btn").attr('disabled', false);
        $("#video-stop-btn").attr('disabled', true);
        $("#video-pause-btn").attr('disabled', true);
        $("#video-play-btn").attr('disabled', true);

        $("#start-recording-btn").attr('disabled', false);
        $("#stop-recording-btn").attr('disabled', true);
        $('#recording-status')
            .removeClass('fa-circle').addClass('fa-stop-circle')
            .removeClass('red').addClass('gray');

        $('#rtmp-status').removeClass('red').addClass('gray');
        $("#rtmp-url-input").attr('readonly', false);
        $("#start-rtmp-btn").attr('disabled', false);
        $("#stop-rtmp-btn").attr('disabled', true);

        $('#lls-status').removeClass('red').addClass('gray');
        $("#lls-stream-name-input").attr('readonly', false);
        $("#lls-ptoken-input").attr('readonly', false);
        $("#start-lls-btn").attr('disabled', false);
        $("#stop-lls-btn").attr('disabled', true);

        $('#send-message-btn').attr('disabled', false);
        $('#send-invitation-btn').attr('disabled', false);

        setRecordingState(VoxeetSDK.recording.current != null);
    } catch (error) {
        logError(error);
    }
});

$('#conference-listen-btn').click(async () => {
    try {
        const liveRecording = $('#chk-live-recording')[0].checked;
    
        // Default conference parameters
        // See: https://docs.dolby.io/communications-apis/docs/js-client-sdk-model-conferenceparameters
        const conferenceParams = {
            liveRecording: liveRecording,
            rtcpMode: "average", // worst, average, max
            ttl: 0,
            videoCodec: "H264", // H264, VP8
            dolbyVoice: false
        };
    
        // See: https://docs.dolby.io/communications-apis/docs/js-client-sdk-model-conferenceoptions
        const conferenceOptions = {
            alias: $('#conference-alias-input').val(),
            params: conferenceParams
        };
    
        // 1. Create a conference room with an alias
        // const conference = await VoxeetSDK.conference.create(conferenceOptions);

        logMessage(`Conference id: ${conference.id} & Conference alias ${conference.alias}`);
        conferenceId = conference.id;

        const listenOptions = {};
        if (conferenceAccessToken) {
            listenOptions.conferenceAccessToken = conferenceAccessToken;
            listenOptions.type= 'regular';
        }
    
        // 2. Join the conference
        await VoxeetSDK.conference.listen(conference, listenOptions);
        
        // Load the Output Audio devices
        const devices = await VoxeetSDK.mediaDevice.enumerateAudioDevices("output");
        setDevices('Output Audio Devices', '#output-audio-devices', '#btn-set-output-audio-device', devices);

        $('#btn-set-webrtc-constraints').attr('disabled', false);

        $('#chk-live-recording').attr('disabled', true);
        $('#conference-join-btn').attr('disabled', true);
        $('#conference-listen-btn').attr('disabled', true);
        $('#conference-leave-btn').attr('disabled', false);
        $('#conference-alias-input').attr('readonly', true);

        $('#start-video-btn').attr('disabled', true);
        $('#stop-video-btn').attr('disabled', true);
        $('#start-bokeh-btn').attr('disabled', true);
        $('#start-bgimg-btn').attr('disabled', true);
        $('#start-audio-btn').attr('disabled', true);
        $('#stop-audio-btn').attr('disabled', true);
        $('#mute-audio-btn').attr('disabled', true);
        $('#unmute-audio-btn').attr('disabled', true);

        $('#start-screenshare-btn').attr('disabled', true);
        $('#stop-screenshare-btn').attr('disabled', true);

        $('#video-url-input').attr('readonly', true);
        $("#video-start-btn").attr('disabled', true);
        $("#video-stop-btn").attr('disabled', true);
        $("#video-pause-btn").attr('disabled', true);
        $("#video-play-btn").attr('disabled', true);

        $("#start-recording-btn").attr('disabled', true);
        $("#stop-recording-btn").attr('disabled', true);
        $('#recording-status')
            .removeClass('fa-circle').addClass('fa-stop-circle')
            .removeClass('red').addClass('gray');

        $('#rtmp-status').removeClass('red').addClass('gray');
        $("#rtmp-url-input").attr('readonly', false);
        $("#start-rtmp-btn").attr('disabled', true);
        $("#stop-rtmp-btn").attr('disabled', true);

        $('#lls-status').removeClass('red').addClass('gray');
        $("#lls-label-input").attr('readonly', false);
        $("#lls-ptoken-input").attr('readonly', false);
        $("#start-lls-btn").attr('disabled', true);
        $("#stop-lls-btn").attr('disabled', true);
        
        $('#send-message-btn').attr('disabled', false);
        $('#send-invitation-btn').attr('disabled', false);

        setRecordingState(VoxeetSDK.recording.current != null);
    } catch (error) {
        logError(error);
    }
});

$('#conference-leave-btn').click(async () => {
    try {
        // Unsubscribe from the participant joined/left events
        const alias = VoxeetSDK.conference.current.alias;
        await VoxeetSDK.notification.unsubscribe([
            {
                type: "Participant.Left",
                conferenceAlias: alias
            },
            {
                type: "Participant.Joined",
                conferenceAlias: alias
            },
            {
                type: "Conference.ActiveParticipants",
                conferenceAlias: alias
            }]
        );

        // Subscribes to the conference.Created and conference.Ended events
        await VoxeetSDK.notification.unsubscribe([
            {
                type: "Conference.Created",
                conferenceAlias: alias
            },
            {
                type: "Conference.Ended",
                conferenceAlias: alias
            },
        ]);

        // Unsubscribes from the invitation event
            await VoxeetSDK.notification.unsubscribe([
                { type: "Invitation" }
            ]);
    
        // Leave the conference
        await VoxeetSDK.conference.leave();

        conferenceAccessToken = null;

        $('#chk-live-recording').attr('disabled', false);

        $('#btn-set-output-audio-device').attr('disabled', true);
        $('#btn-set-input-audio-device').attr('disabled', true);
        $('#btn-set-video-device').attr('disabled', true);
        
        $('#btn-set-webrtc-constraints').attr('disabled', true);

        $("#conference-join-btn").attr('disabled', false);
        $("#conference-listen-btn").attr('disabled', false);
        $("#conference-leave-btn").attr('disabled', true);
        $('#conference-alias-input').attr('readonly', false);

        $('[data-conference="on"] button').attr('disabled', true);

        $('#video-url-input').attr('readonly', false);

        $('#recording-status')
            .removeClass('fa-circle').addClass('fa-stop-circle')
            .removeClass('red').addClass('gray');

        $('#rtmp-status').removeClass('red').addClass('gray');
        $("#rtmp-url-input").attr('readonly', false);

        // Empty the last video elements
        $('#streams-containers').empty();
        // Empty the list of participants
        $('#participants-list').empty();
    } catch (error) {
        logError(error);
    }
});

$('#btn-set-video-device').click(async () => {
    await VoxeetSDK.mediaDevice.selectVideoInput($('#video-devices').val());
});

$('#btn-set-input-audio-device').click(async () => {
    await VoxeetSDK.mediaDevice.selectAudioInput($('#input-audio-devices').val());
});

$('#btn-set-output-audio-device').click(async () => {
    await VoxeetSDK.mediaDevice.selectAudioOutput($('#output-audio-devices').val());
});


const startVideo = () => {
    const hasAudio = VoxeetSDK.session.participant.streams.length && VoxeetSDK.session.participant.streams[0].getAudioTracks().length > 0;
    const payloadConstraints = getConstraints(hasAudio, true);
    if (payloadConstraints.constraints.video == true) {
        payloadConstraints.constraints.video = { deviceId: $('#video-devices').val() };
    } else {
        payloadConstraints.constraints.video.deviceId = $('#video-devices').val();
    }
    logMessage("VoxeetSDK.conference.startVideo with the options:");
    logMessage(JSON.stringify(payloadConstraints.constraints.video));

    // Start sharing the video with the other participants
    // VoxeetSDK.conference
    //     .startVideo(VoxeetSDK.session.participant, payloadConstraints.constraints.video)
    //     .then(() => {
    //         $("#start-video-btn").attr('disabled', true);
    //         $("#stop-video-btn").attr('disabled', false);
    //         $("#start-bokeh-btn").attr('disabled', false);
    //     })
    //     .catch((err) => logError(err));
    const videoConstraints = {
        // width: {
        //     min: "1920",
        // },
        // height: {
        //     min: "1080",
        // },
    };
    const videoProcessesor = {type: 'bokeh'};
    VoxeetSDK.video.local.start(videoConstraints, videoProcessesor).then(() => {
        // VoxeetSDK.video.local.setProcessor({}).then(() => {
        //     $("#start-bokeh-btn").attr('disabled', false);

        // }).catch((err) => {
        //     logError(err);
        //     console.log("Error on start video with Bokeh", err);
        // })
        $("#start-video-btn").attr('disabled', true);
        $("#stop-video-btn").attr('disabled', false);

    }).catch((err) => {
        logError(err);
        console.log("Error on start video", err);
    })
};

$("#start-video-btn").click(startVideo);

$("#stop-video-btn").click(() => {
    logMessage("VoxeetSDK.conference.stopVideo");
   
    // Stop sharing the video with the other participants
    VoxeetSDK.conference.stopVideo(VoxeetSDK.session.participant)
        .then(() => {
            $("#start-video-btn").attr('disabled', false);
            $("#stop-video-btn").attr('disabled', true);
            $("#start-bokeh-btn").attr('disabled', true);
            $("#start-bgimg-btn").attr('disabled', true);
        })
        .catch((err) => logError(err));
});

$("#start-bokeh-btn").click(() => {
    logMessage("VoxeetSDK.conference.startBokeh");
   
     VoxeetSDK.video.local.setProcessor({ type: "bokeh" })
     .then(()=>{
         console.log('Bokeh mode');
     })
     .catch((err) => logError(err));;
});



$("#start-bgimg-btn").click(async() => {
    logMessage("Setting background image");

    // await VoxeetSDK.video.local.setProcessor({ type: undefined });
    const img = await loadImage();
    // const img = document.getElementById("imgbackground");
    
    console.log('image loaded');
     VoxeetSDK.video.local.setProcessor({ type: "backgroundreplacement", image: img })
     .then(()=>{
         console.log('background image mode');
     })
     .catch((err) => logError(err));;
});

const loadImage = async()=>{
    const img1 = document.createElement("img");
    img1.id = 'imgbackground';
    img1.src = "./images/background.jpg";
    img1.alt = "background";

   return img1;
}

// Add a video stream to the web page
const addVideoNode = (participant, stream) => {
    let element = $(`#stream-${participant.id}`);
    if (!element.length) {
        let data = {
            id: participant.id,
            name: participant.info.name
        };
    
        let template = $.templates("#template-video");
        element = $(template.render(data));
    
        $("#streams-containers").append(element);
    }

    updateVideoMessage(participant, stream);

    // Attach the video steam to the video element
    let video = element.find('video')[0];
    navigator.attachMediaStream(video, stream);
};

const updateVideoMessage = (participant, stream) => {
    let element = $(`#stream-${participant.id}`);
    if (element.length) {
        let text = 'unknown resolution';
        if (stream.getVideoTracks().length > 0) {
            let streamSettings = stream.getVideoTracks()[0].getSettings();
            if (streamSettings && streamSettings.width) {
                text = `Resolution ${streamSettings.width} x ${streamSettings.height}`;
            }
        }

        element.find('.resolution').text(text);
    }
}
  
// Remove the video stream from the web page
const removeVideoNode = (participant) => {
    const video = $(`#stream-${participant.id} video`);
    if (video.length) {
        video[0].srcObject = null; // Prevent memory leak in Chrome
    }
    $(`#stream-${participant.id}`).remove();
};



$("#start-audio-btn").click(() => {
    logMessage("VoxeetSDK.conference.startAudio");

    // Start sharing the audio with the other participants
    VoxeetSDK.conference.startAudio(VoxeetSDK.session.participant)
        .then(() => VoxeetSDK.mediaDevice.selectAudioInput($('#input-audio-devices').val()))
        .then(() => {
            $("#start-audio-btn").attr('disabled', true);
            $("#stop-audio-btn").attr('disabled', false);
            $("#mute-audio-btn").attr('disabled', false);
            $("#unmute-audio-btn").attr('disabled', true);
        })
        .catch((err) => logError(err));
});

$("#stop-audio-btn").click(() => {
    logMessage("VoxeetSDK.conference.stopAudio");

    // Stop sharing the audio with the other participants

    VoxeetSDK.conference.stopAudio(VoxeetSDK.session.participant)
        .then(() => {
            $("#start-audio-btn").attr('disabled', false);
            $("#stop-audio-btn").attr('disabled', true);
            $("#mute-audio-btn").attr('disabled', true);
            $("#unmute-audio-btn").attr('disabled', true);
        })
        .catch((err) => logError(err));
});

$("#mute-audio-btn").click(() => {
    logMessage("VoxeetSDK.conference.mute true");
    VoxeetSDK.conference.mute(VoxeetSDK.session.participant, true);

    $("#mute-audio-btn").attr('disabled', true);
    $("#unmute-audio-btn").attr('disabled', false);
});

$("#unmute-audio-btn").click(() => {
    logMessage("VoxeetSDK.conference.mute false");
    VoxeetSDK.conference.mute(VoxeetSDK.session.participant, false);

    $("#mute-audio-btn").attr('disabled', false);
    $("#unmute-audio-btn").attr('disabled', true);
});



$("#start-screenshare-btn").click(() => {
    logMessage('VoxeetSDK.conference.startScreenShare');

    // Start screen sharing with the other participants
    VoxeetSDK.conference.startScreenShare()
        .then(() => {
            $("#start-screenshare-btn").attr('disabled', true);
            $("#stop-screenshare-btn").attr('disabled', false);
        })
        .catch((err) => logError(err));
});

$("#stop-screenshare-btn").click(() => {
    logMessage("VoxeetSDK.conference.stopScreenShare");

    // Stop screen sharing with the other participants
    VoxeetSDK.conference.stopScreenShare()
        .then(() => {
            $("#start-screenshare-btn").attr('disabled', false);
            $("#stop-screenshare-btn").attr('disabled', true);
        })
        .catch((err) => logError(err));
});

// Add a screen share stream to the web page
const addScreenShareNode = (participant, stream) => {
    let element = $('#stream-screenshare');
    if (!element.length) {
        let data = {
            name: participant.info.name
        };
    
        let template = $.templates("#template-screenshare");
        element = $(template.render(data));
    
        $("#streams-containers").append(element);
    }

    // Attach the video steam to the video element
    let video = element.find('video')[0];
    navigator.attachMediaStream(video, stream);
}

// Remove the screen share stream from the web page
const removeScreenShareNode = () => {
    const video = $('#stream-screenshare video');
    if (video.length) {
        video[0].srcObject = null; // Prevent memory leak in Chrome
    }
    $('#stream-screenshare').remove();

    $("#start-screenshare-btn").attr('disabled', false);
    $("#stop-screenshare-btn").attr('disabled', true);
}


// Add a new participant to the list
const addUpdateParticipantNode = (participant) => {
    let template = $.templates("#template-participant");

    let elem = $(`#participant-${participant.id}`);
    const element = $(template.render({
        id: participant.id,
        avatarUrl: participant.info.avatarUrl,
        name: participant.info.name,
        status: participant.status,
        isLocal: participant.id === VoxeetSDK.session.participant.id,
    }));

    if (!elem.length) {
        element.appendTo('#participants-list');
    } else {
        elem.replaceWith(element);
    }
};

// Remove a participant from the list
const removeParticipantNode = (participant) => {
    $(`#participant-${participant.id}`).remove();
};



$("#video-start-btn").click(() => {
    const videoUrl = $('#video-url-input').val();
    logMessage(`VoxeetSDK.videoPresentation.start ${videoUrl}`);

    VoxeetSDK.videoPresentation
        .start(videoUrl)
        .then(() => {
            $('#video-url-input').attr('readonly', true);
            $("#video-start-btn").attr('disabled', true);
            $("#video-stop-btn").attr('disabled', false);
            $("#video-pause-btn").attr('disabled', false);
            $("#video-play-btn").attr('disabled', true);
        })
        .catch((err) => logError(err));
});

$("#video-stop-btn").click(() => {
    logMessage('VoxeetSDK.videoPresentation.stop');
    VoxeetSDK.videoPresentation
        .stop()
        .then(() => {
            $('#video-url-input').attr('readonly', false);
            $("#video-start-btn").attr('disabled', false);
            $("#video-stop-btn").attr('disabled', true);
            $("#video-pause-btn").attr('disabled', true);
            $("#video-play-btn").attr('disabled', true);
        })
        .catch((err) => logError(err));
});

$("#video-pause-btn").click(() => {
    const timestamp = Math.round($(`#stream-video video`)[0].currentTime * 1000);
    logMessage(`VoxeetSDK.videoPresentation.pause at ${timestamp}ms`);
    VoxeetSDK.videoPresentation
        .pause(timestamp)
        .then(() => {
            $("#video-pause-btn").attr('disabled', true);
            $("#video-play-btn").attr('disabled', false);
        })
        .catch((err) => logError(err));
});

$("#video-play-btn").click(() => {
    logMessage('VoxeetSDK.videoPresentation.play');
    VoxeetSDK.videoPresentation
        .play()
        .then(() => {
            $("#video-pause-btn").attr('disabled', false);
            $("#video-play-btn").attr('disabled', true);
        })
        .catch((err) => logError(err));
});

const addVideoPlayer = (videoUrl) => {
    let element = $(`#stream-video`);
    if (!element.length) {
        let data = {
            url: videoUrl
        };
    
        let template = $.templates("#template-video-url");
        element = $(template.render(data));
    
        $("#streams-containers").append(element);
    }
};


/**
 * RECORDING
 */

const setRecordingState = (isRecording) => {
    if (isRecording) {
        $('#recording-status')
            .removeClass('fa-stop-circle').addClass('fa-circle')
            .removeClass('gray').addClass('red');
    } else {
        $('#recording-status')
            .removeClass('fa-circle').addClass('fa-stop-circle')
            .removeClass('red').addClass('gray');
    }

    $("#start-recording-btn").attr('disabled', isRecording);
    $("#stop-recording-btn").attr('disabled', !isRecording);
};

$("#start-recording-btn").click(() => {
    logMessage('VoxeetSDK.recording.start()');

    // Start recording the conference
    VoxeetSDK.recording.start()
        .then(() => setRecordingState(true))
        .catch((err) => logError(err));
});

$("#stop-recording-btn").click(() => {
    logMessage('VoxeetSDK.recording.stop()');
    
    // Stop recording the conference
    VoxeetSDK.recording.stop()
        .then(() => setRecordingState(false))
        .catch((err) => logError(err));
});


/**
 * Send a message
 */

$('#send-message-btn').click(() => {
    logMessage('VoxeetSDK.command.send()');

    VoxeetSDK.command
        .send($("#message-input").val())
        .then(() => {
            $("#message-input").val();
        })
        .catch((err) => logError(err));
});


/**
 * Send invitation
 */

$('#send-invitation-btn').click(() => {
    const externalId = $("#invite-input").val();
    logMessage(`VoxeetSDK.notification.invite('${externalId}')`);

    var participants = [
        { externalId: externalId }
    ];

    VoxeetSDK.notification
        .invite(VoxeetSDK.conference.current, participants)
        .then(() => {
            logMessage(`Invitation sent to ${externalId}`);
        })
        .catch((err) => logError(err));
});



//  $("#send-invitation-btn").click(async () => {
//     const streamName = $('#lls-stream-name-input').val();
//     const pToken = $('#lls-ptoken-input').val();
//     logMessage(`Start LLS to ${streamName}`);

//     const jwt = await getAPIToken();

//     const url = `https://comms.api.dolby.io/v2/conferences/mix/${conferenceId}/rts/start`;
//     $.ajax({
//         async : true,
//         type: "POST",
//         url: url,
//         contentType: "application/json",
//         data: JSON.stringify({alias: 'android', ownerExternalId: '123'}),
//         headers: {
//             "Authorization": "Bearer " + jwt.access_token
//         }
//     }).done(function () {
//         logMessage('LLS start success!')
//         $('#lls-status').addClass('red').removeClass('gray');
//         $("#lls-stream-name-input").attr('readonly', true);
//         $("#lls-ptoken-input").attr('readonly', true);
//         $("#start-lls-btn").attr('disabled', true);
//         $("#stop-lls-btn").attr('disabled', false);
//     }).fail(function (err) {
//         logError(err);
//     });
// });

/**
 * Create Conference
 */

$("#create-btn").click(async () => {
    const confName = $('#confname-input').val();
    logMessage(`Create conference  ${confName}`);

    const jwt = await getAPIToken();

    const url = `https://comms.api.dolby.io/v2/conferences/create`;
    $.ajax({
        async : true,
        type: "POST",
        url: url,
        contentType: "application/json",
        data: JSON.stringify({alias: 'android', ownerExternalId: '123'}),
        headers: {
            "Authorization": "Bearer " + jwt.access_token
        }
    }).done(function (response) {
        console.log('Resp: ' + JSON.stringify(response));
        // conference = response;
        logMessage('Conference created  success!')
       
    }).fail(function (err) {
        logError(err);
    });
});

/**
 * Fetch Conference
 */

 $("#fetch-btn").click(async () => {
    const confId = $('#confid-input').val();
    logMessage(`ConfId ${confId}`);
    // Fetch the already created conference 
    conference = await VoxeetSDK.conference.fetch(confId);
    console.log('Conference: ' + JSON.stringify(conference));

});


const isAppKeyConfigured = () => {
    return appKey && appKey !== "" && appSecret && appSecret !== "";
};

const getClientAccessToken = () => {
    return new Promise((resolve, reject) => {
        $.ajax({
            async : true,
            type: "POST",
            url: "https://session.voxeet.com/v1/oauth2/token",
            contentType: "application/x-www-form-urlencoded",
            data: "grant_type=client_credentials",
            headers: {
                "Accept": "application/json",
                "Cache-Control": "no-cache",
                "Authorization": "Basic " + btoa(`${appKey}:${appSecret}`),
            }
        }).done(function (data) {
            resolve(data);
        }).fail(function (err) {
            reject(err);
        });
    });
};

const getAPIToken = () => {
    return new Promise((resolve, reject) => {
        $.ajax({
            async : true,
            type: "POST",
            url: "https://api.voxeet.com/v1/auth/token",
            contentType: "application/x-www-form-urlencoded",
            data: "grant_type=client_credentials",
            headers: {
                "Accept": "application/json",
                "Cache-Control": "no-cache",
                "Authorization": "Basic " + btoa(`${appKey}:${appSecret}`),
            }
        }).done(function (data) {
            resolve(data);
        }).fail(function (err) {
            reject(err);
        });
    });
};

/**
 * RTMP Streaming
 */

$("#start-rtmp-btn").click(async () => {
    const rtmpUrl = $('#rtmp-url-input').val();
    logMessage(`Start RTMP stream to ${rtmpUrl}`);

    const jwt = await getAPIToken();

    const url = `https://api.voxeet.com/v2/conferences/mix/${conferenceId}/rtmp/start`;
    $.ajax({
        async : true,
        type: "POST",
        url: url,
        contentType: "application/json",
        data: JSON.stringify({ uri: rtmpUrl }),
        headers: {
            "Authorization": "Bearer " + jwt.access_token
        }
    }).done(function () {
        $('#rtmp-status').addClass('red').removeClass('gray');
        $("#rtmp-url-input").attr('readonly', true);
        $("#start-rtmp-btn").attr('disabled', true);
        $("#stop-rtmp-btn").attr('disabled', false);
    }).fail(function (err) {
        logError(err);
    });
});

$("#stop-rtmp-btn").click(async () => {
    logMessage('Stop the RTMP stream');

    const jwt = await getAPIToken();

    const url = `https://api.voxeet.com/v2/conferences/mix/${conferenceId}/rtmp/stop`;
    $.ajax({
        async : true,
        type: "POST",
        url: url,
        contentType: "application/json",
        data: JSON.stringify({}),
        headers: {
            "Authorization": "Bearer " + jwt.access_token
        },
    }).done(function () {
        $('#rtmp-status').removeClass('red').addClass('gray');
        $("#rtmp-url-input").attr('readonly', false);
        $("#start-rtmp-btn").attr('disabled', false);
        $("#stop-rtmp-btn").attr('disabled', true);
    }).fail(function (err) {
        logError(err);
    });
});

/**
 * Low Latency Streaming (LLS)
 */

$("#start-lls-btn").click(async () => {
    const streamName = $('#lls-stream-name-input').val();
    const pToken = $('#lls-ptoken-input').val();
    logMessage(`Start LLS to ${streamName}`);

    const jwt = await getAPIToken();

    const url = `https://comms.api.dolby.io/v2/conferences/mix/${conferenceId}/rts/start`;
    $.ajax({
        async : true,
        type: "POST",
        url: url,
        contentType: "application/json",
        data: JSON.stringify({ streamName: streamName, publishingToken: pToken }),
        headers: {
            "Authorization": "Bearer " + jwt.access_token
        }
    }).done(function () {
        logMessage('LLS start success!')
        $('#lls-status').addClass('red').removeClass('gray');
        $("#lls-stream-name-input").attr('readonly', true);
        $("#lls-ptoken-input").attr('readonly', true);
        $("#start-lls-btn").attr('disabled', true);
        $("#stop-lls-btn").attr('disabled', false);
    }).fail(function (err) {
        logError(err);
    });
});

$("#stop-lls-btn").click(async () => {
    logMessage('Stop the LLS');

    const jwt = await getAPIToken();

    const url = `https://comms.api.dolby.io/v2/conferences/mix/${conferenceId}/rts/stop`;
    $.ajax({
        async : true,
        type: "POST",
        url: url,
        contentType: "application/json",
        data: JSON.stringify({}),
        headers: {
            "Authorization": "Bearer " + jwt.access_token
        }
    }).done(function () {
        $('#lls-status').removeClass('red').addClass('gray');
        $("#lls-stream-name-input").attr('readonly', false);
        $("#lls-ptoken-input").attr('readonly', false);
        $("#start-lls-btn").attr('disabled', false);
        $("#stop-lls-btn").attr('disabled', true);
    }).fail(function (err) {
        logError(err);
    });
});

$("#btn-use-sdk-versions").click(async () => {
    const script = document.createElement('script');

    const sdkVersion = $('#sdk-versions').val();
    script.src = `https://cdn.jsdelivr.net/npm/@voxeet/voxeet-web-sdk@${sdkVersion}/dist/voxeet-sdk.min.js`;

    script.addEventListener('load', async () => {
        logMessage(`Dolby.io Communications SDK version ${sdkVersion} loaded from ${script.src}`);

        const _isAppKeyConfigured = isAppKeyConfigured();
        if (!_isAppKeyConfigured) {
            // Hide backend operations when the API Key / Secret are not configured
            $('[data-app-key-defined="yes"]').hide();
        }

        // Automatically try to load the Access Token
        // const urlParams = new URLSearchParams(window.location.search);
        // const accessToken = urlParams.get('token');
        // if (accessToken && accessToken.length > 0) {
        //     $('#access-token-input').val(accessToken);
        //     initializeSDK(accessToken);
        // } else if (_isAppKeyConfigured) {
        //     const jwt = await getClientAccessToken();
        //     $('#access-token-input').val(jwt.access_token);
        //     initializeSDK(jwt.access_token);
        // } else {
        //     $('#initialize-btn').attr('disabled', false);
        // }

        // Set the Dolby.io SDK Version
        $('#sdk-version').text(VoxeetSDK.version);

        registerEvents();
    });

    // Append to the `head` element
    document.head.appendChild(script);

    $('#btn-use-sdk-versions').attr('disabled', true);
});

$(function() {
    // Generate a random username
    let rand = Math.round(Math.random() * 10000);
    $('#external-id-input').val(`guest-${rand}`);
    $('#username-input').val(`Guest ${rand}`);
    $('#avatar-url-input').val(`https://gravatar.com/avatar/${rand}?s=200&d=identicon`);

    // Generate a random conference alias
    let conferenceAlias = "conf" ;
    $('#conference-alias-input').val(conferenceAlias);
});
