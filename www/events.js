const registerEvents = () => {
    // When a video stream is added to the conference
    VoxeetSDK.conference.on('streamAdded', (participant, stream) => {
        logMessage(`Event - streamAdded from ${participant.info.name} (${participant.id})`);

        if (stream.type === 'ScreenShare') {
            return addScreenShareNode(participant, stream);
        }

        if (stream.getVideoTracks().length) {
            // Only add the video node if there is a video track
            addVideoNode(participant, stream);
        }
    });

    // When a video stream is updated from the conference´
    VoxeetSDK.conference.on('streamUpdated', (participant, stream) => {
        // logMessage(`Event - streamUpdated from ${participant.info.name} (${participant.id})`);

        if (stream.type === 'ScreenShare') return;

        if (stream.getVideoTracks().length) {
            // Only add the video node if there is a video track
            addVideoNode(participant, stream);
            updateVideoMessage(participant, stream);
        } else {
            removeVideoNode(participant);
        }
    });

    // When a video stream is removed from the conference
    VoxeetSDK.conference.on('streamRemoved', (participant, stream) => {
        // logMessage(`Event - streamRemoved from ${participant.info.name} (${participant.id})`);

        if (stream.type === 'ScreenShare') {
            return removeScreenShareNode();
        }

        removeVideoNode(participant);
    });


    VoxeetSDK.conference.on('participantAdded', (participant) => {
        logMessage(`Event - participantAdded from ${participant.info.name} (${participant.id})`);
        addUpdateParticipantNode(participant);
    });
    VoxeetSDK.conference.on('participantUpdated', (participant) => {
        // logMessage(`Event - participantUpdated from ${participant.info.name} (${participant.id}) - Status: ${participant.status}`);

        if (participant.status === 'Decline' ||
            participant.status === 'Error' ||
            participant.status === 'Kicked' ||
            participant.status === 'Left') {
            removeParticipantNode(participant);
        } else {
            addUpdateParticipantNode(participant);
        }
    });


    VoxeetSDK.videoPresentation.on('started', (vp) => {
        logMessage(`Event - videoPresentation started ${vp.url}`);

        addVideoPlayer(vp.url);
        $(`#stream-video video`)[0].currentTime = vp.timestamp;
    });

    VoxeetSDK.videoPresentation.on('paused', (vp) => {
        logMessage(`Event - videoPresentation paused at ${vp.timestamp}ms`);

        $(`#stream-video video`)[0].pause();
        $(`#stream-video video`)[0].currentTime = vp.timestamp / 1000;
    });

    VoxeetSDK.videoPresentation.on('played', (vp) => {
        logMessage('Event - videoPresentation played');

        $(`#stream-video video`)[0].play();
    });

    VoxeetSDK.videoPresentation.on('sought', (vp) => {
        logMessage(`Event - videoPresentation sought to ${vp.timestamp}ms`);

        $(`#stream-video video`)[0].currentTime = vp.timestamp / 1000;
    });

    VoxeetSDK.videoPresentation.on('stopped', () => {
        logMessage('Event - videoPresentation stopped');

        $(`#stream-video`).remove();
    });

    // Invitation to join a conference received
    VoxeetSDK.notification.on("invitation", (invite) => {
        logMessage(`Event - invitation to join the conference ${invite.conferenceAlias} (${invite.conferenceId}) received from ${invite.participant.info.name}`);

        $('#conference-alias-input').val(invite.conferenceAlias);
        conferenceAccessToken = invite.conferenceAccessToken;
    });

    // When participants Join 
    VoxeetSDK.notification.on('participantJoined', (e) => {
        logMessage(`Event - Participant Joined  ${e.participant.info.name}`);
        console.log(`Event - Participant Joined  ${e.participant.info.name}`);
    });

    // When participants Left 
    VoxeetSDK.notification.on('participantLeft', (e) => {
        logMessage(`Event - Participant Left  ${e.participant.info.name}`);
        console.log(`Event - Participant Left  ${e.participant.info.name}`);
    });

    // When participants Join/left
    VoxeetSDK.notification.on('activeParticipants', (e) => {
        // logMessage(`Event - activeParticipants count  ${e.participantCount}`);
        console.log('Active Participant: ' + JSON.stringify(e.participants))
    });

     // When ConferenceCreated
     VoxeetSDK.notification.on('conferenceCreated', (e) => {
        // logMessage(`Event - activeParticipants count  ${e.participantCount}`);
        console.log('Conference created: ' + JSON.stringify(e))
    });
    // When ConferenceEnded
    VoxeetSDK.notification.on('conferenceEnded', (e) => {
        // logMessage(`Event - activeParticipants count  ${e.participantCount}`);
        console.log('Conference ended: ' + JSON.stringify(e))

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
    });

    // When other participants send a command
    VoxeetSDK.command.on('received', (participant, message) => {
        logMessage(`Event - command received from ${participant.info.name}: ${message}`);
        console.log(`Event - command received from ${participant.info.name}: ${message}`);
    });


};


