const { ipcRenderer } = require('electron')
const desktopCapturer = {
  getSources: (opts) => ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', opts)
}
const remote = require('@electron/remote');
const { writeFile } = require('fs');
const { dialog, Menu } = remote;

// Global state
let mediaRecorder; // MediaRecorder instance to capture footage
let recordedChunks = [];
let tempChunks = [];

// Buttons
const videoElement = document.querySelector('video');

const startBtn = document.getElementById('startBtn');
startBtn.onclick = e => { 
  var state = startBtn.getAttribute('data-state')

  if(state  == '0'){
    try{
      startBtn.classList.remove('btn-primary');
      startBtn.classList.add('btn-success');
      startBtn.setAttribute('data-state','1');
      startBtn.firstElementChild.classList.remove('fa-circle-play');
      startBtn.firstElementChild.classList.add('fa-record-vinyl');
      mediaRecorder.start();
      videoSelectBtn.disabled = true;
    } catch (e) {
      dialog.showErrorBox('Error', 'Select a window to record first.'); 
      startBtn.classList.add('btn-primary');
      startBtn.classList.remove('btn-success');
      startBtn.setAttribute('data-state',state+'');
      startBtn.firstElementChild.classList.add('fa-circle-play');
      startBtn.firstElementChild.classList.remove('fa-record-vinyl');
    }
  } else if(state == '1') {
    startBtn.classList.remove('btn-success');
    startBtn.classList.add('btn-warning');
    startBtn.setAttribute('data-state','2');
    startBtn.firstElementChild.classList.remove('fa-record-vinyl');
    startBtn.firstElementChild.classList.add('fa-circle-pause');
    mediaRecorder.pause();
  } else {
    startBtn.classList.remove('btn-warning');
    startBtn.classList.add('btn-success');
    startBtn.setAttribute('data-state','1');
    startBtn.firstElementChild.classList.remove('fa-circle-pause');
    startBtn.firstElementChild.classList.add('fa-record-vinyl');
    mediaRecorder.resume();
  }
};

const stopBtn = document.getElementById('stopBtn');
stopBtn.onclick = e => {
  startBtn.classList.remove('btn-warning');
  startBtn.classList.remove('btn-success');
  startBtn.classList.add('btn-primary');
  startBtn.setAttribute('data-state','0');
  startBtn.firstElementChild.classList.remove('fa-circle-pause');
  startBtn.firstElementChild.classList.remove('fa-record-vinyl');
  startBtn.firstElementChild.classList.add('fa-circle-play');
  videoSelectBtn.disabled = false;
  mediaRecorder.stop();
};

const videoSelectBtn = document.getElementById('videoSelectBtn');
videoSelectBtn.onclick = getVideoSources;

// Get the available video sources
async function getVideoSources() {
  const inputSources = await desktopCapturer.getSources({
                                types: ['window', 'screen']
                            });

  const videoOptionsMenu = Menu.buildFromTemplate(
    inputSources.map(source => {
      return {
        label: source.name,
        click: () => selectSource(source)
      };
    })
  );


  videoOptionsMenu.popup();
}

// Change the videoSource window to record
async function selectSource(source) {

  videoSelectBtn.innerText = source.name;

  const constraints = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id
      }
    }
  };

  // Create a Stream
  const stream = await navigator.mediaDevices.getUserMedia(constraints);

  // Preview the source in a video element
  videoElement.srcObject = stream;
  videoElement.play();

  // Create the Media Recorder
  const options = { mimeType: 'video/webm; codecs=vp9' };
  mediaRecorder = new MediaRecorder(stream, options);

  // Register Event Handlers
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.onstop = handleStop;
  mediaRecorder.onpause = handlePause;
  mediaRecorder.onresume = handleResume;

  // Updates the UI
}

// Captures all recorded chunks
function handleDataAvailable(e) {
  console.log('video data available');
  recordedChunks.push(e.data);
}

async function handlePause(e) {
  tempChunks = recordedChunks;
  recordedChunks = [];
}

async function handleResume(e) {
  recordedChunks = tempChunks;
  tempChunks = [];
  recordedChunks.push(e.data);
}

// Saves the video file on stop
async function handleStop(e) {
  const blob = new Blob(recordedChunks, {
    type: 'video/webm; codecs=vp9'
  });

  const buffer = Buffer.from(await blob.arrayBuffer());

  const { filePath } = await dialog.showSaveDialog({
    buttonLabel: 'Save video',
    defaultPath: `vid-${Date.now()}.webm`
  });

  if (filePath) {
    writeFile(filePath, buffer, () => console.log('video saved successfully!'));
  }

}
