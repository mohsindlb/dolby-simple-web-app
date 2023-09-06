const accessToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkb2xieS5pbyIsImlhdCI6MTY4NTQyMDI2Nywic3ViIjoieUxLeXdUbE16em9xS2NDcjVhamF2dz09IiwiYXV0aG9yaXRpZXMiOlsiUk9MRV9DVVNUT01FUiJdLCJ0YXJnZXQiOiJzZXNzaW9uIiwib2lkIjoiMGZhYzJhZDgtMjlmZC00N2E0LWIwMWMtNjM2NDY2ZTQzMzgwIiwiYWlkIjoiN2Y5MjcxMDYtNDA1ZC00NzBlLWJiNTItZDU1MTY3ODJkYzIwIiwiYmlkIjoiOGEzNjk1OTg4ODRkMTczMjAxODg0ZjA5Y2M1MjYxZTciLCJleHAiOjE2ODU1MDY2Njd9.TgZ-CfV3SsOaa3Pwef__VLTyEhHsvqRg9quoSnh7TkHkFFv287Ef05N9jXBksBF-qjht-KXlS31cq4aHA9ewzg`;
const initializeSDK = (accessToken) => {
   return VoxeetSDK.initializeToken(accessToken, () => new Promise((resolve) => resolve(accessToken)));
};
initializeSDK(accessToken);

const isConnected = (participant) => {
    return [ 'Decline', 'Error', 'Kicked', 'Left' ].indexOf(participant.status) < 0;
};

const genrateRandomName = () => {
    let number = new Date().valueOf() - 1681299878466;
    let string = '';
    while (number != 0) {
        let temp = number % 10;
        string = string + String.fromCharCode(97 + temp);
        number = parseInt(number / 10);
    }
    return string
}

const setPosition = async (position)=>{
    await VoxeetSDK.command.send({
        action: 'updatePosition',
        position:position 
    });
    const participantInfo = VoxeetSDK.conference.participants.get(VoxeetSDK.session.participant.id);
    await setSpatialPosition(participantInfo,position);
}


/**
 * Load the audio and video devices.
 */
const loadAudioVideoDevices = async () => {
    try {
        // Load the Output Audio devices
        const audioOutput = await VoxeetSDK.mediaDevice.enumerateAudioOutputDevices();

        // Load the Input Audio devices
        const audioInput = await VoxeetSDK.mediaDevice.enumerateAudioInputDevices();
        console.log('Input Audio Devices', audioInput);

        // Load the Video devices
        const videoInput = await VoxeetSDK.mediaDevice.enumerateVideoInputDevices();
    } catch (error) {
        console.error(error);
    }
};


const setSpatialEnvironment = async ()=>{
    const scale   = { x: window.innerWidth / 1, y: window.innerHeight / 1, z: 1 };
    const forward = { x: 0, y: -1, z: 0 };
    const up      = { x: 0, y: 0,  z: 1 };
    const right   = { x: 1, y: 0,  z: 0 };

    VoxeetSDKExt.privateZones.setSpatialEnvironment(scale, forward, up, right);
}

/**
 * Add a graphical element to indicate when a user is speaking.
 */
const listenIsSpeaking = () => {
    listenIsSpeakingIntervalId = setInterval(() => {
        [...VoxeetSDK.conference.participants].map((val) => {
            const participant = val[1];
            VoxeetSDK.conference.isSpeaking(participant, (isSpeaking) => {});
        });
    }, 500);
};

const createAndJoinConference = async ()=>{
    let name = genrateRandomName();
    let avatarUrl = '';
    await VoxeetSDK.session.open({name , avatarUrl });
    const joinOptions = {
        constraints: {
            audio: true,
            video: false
        },
        preferRecvMono: false,
        preferSendMono: false,
        spatialAudio: true, // Turn on Spatial Audio
    };

    const conferenceOptions = {
        alias: 'testing',
        // See: https://docs.dolby.io/communications-apis/docs/js-client-sdk-model-conferenceparameters
        params: {
            liveRecording: false,
            rtcpMode: 'average', // worst, average, max
            ttl: 0,
            videoCodec: 'H264', // H264, VP8
            dolbyVoice: true,
            spatialAudioStyle: 'shared',
        }
    };


    // Create the conference
    const conference = await VoxeetSDK.conference.create(conferenceOptions);            
    // Join the conference
    await VoxeetSDK.conference.join(conference, joinOptions);
    // Set the spatial audio scene
    await setSpatialEnvironment();
    // Load the Audio Video devices in case the user
    // wants to change device
    // await loadAudioVideoDevices();
    // Start listening to who is speaking
    // to add a visual indication on the UI
    // listenIsSpeaking();
}


const setSpatialPosition = async (participant,spatialPosition) => {
    if (!isConnected(participant)) return;
    return await VoxeetSDKExt.privateZones.setSpatialPosition(participant, spatialPosition);
};




createAndJoinConference().then(res=>{
    VoxeetSDK.conference.on('participantAdded', async (participant) => {
        if (!isConnected(participant)) return;
        // addUser(participant);
        await setSpatialPosition(participant,{x:0,y:0,z:0});
    });
    
    VoxeetSDK.conference.on('participantUpdated', async (participant) => {    
        if (isConnected(participant)) {
                // addUser(participant);
                console.log(' participantUpdated ----------> ',participant);
                await setSpatialPosition(participant,{x:0,y:0,z:0});
        } 
    });

    VoxeetSDK.command.on("received",async  (participant, message) => {
        const jMessage = JSON.parse(message);
        if (jMessage.action === 'updatePosition') {
            const participantInfo = VoxeetSDK.conference.participants.get(participant.id);
            await setSpatialPosition(participantInfo,jMessage.position)
            // changePlayerPositon(participant.id,jMessage.position)
            console.log('updatePosition ---------->  ',participant.id, jMessage.position);
        }
    });
    
    VoxeetSDK.conference.on("left", async () => {
        await VoxeetSDK.session.close();
    });
}).catch(eer=>{
    console.log('Error ---------> ',err);
})

const toggleSpecialMic = (status) =>{
    VoxeetSDK.conference.mute(VoxeetSDK.session.participant, status);
}