const mediaSource = new MediaSource();
mediaSource.addEventListener('sourceopen', handleSourceOpen, false);
let mediaRecorder: MediaRecorder;
let recordedBlobs: Blob[];
let sourceBuffer: SourceBuffer;

const recordButton = document.querySelector('button#record') as HTMLButtonElement;
const downloadButton = document.querySelector('button#download') as HTMLButtonElement;

const downloadButtonImg = document.getElementById("download-img-btn") as HTMLButtonElement;

recordButton.onclick = toggleRecording;
downloadButton.onclick = download;

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const stream = canvas.captureStream(); // frames per second

downloadButtonImg.onclick = function(){
    let dataURL = canvas.toDataURL('image/png', 1.0);

    let downloadLink = document.createElement('a');
    downloadLink.href = dataURL;
    downloadLink.download = 'canvas-image.png';

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
};

function download() {
    const blob = new Blob(recordedBlobs, {type: 'video/webm'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'test.webm';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
}

function handleSourceOpen(event: Event) {
    console.log('MediaSource opened');
    sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vp8"');
    console.log('Source buffer: ', sourceBuffer);
}


function handleStop(event: Event) {
    console.log('Recorder stopped: ', event);
    const superBuffer = new Blob(recordedBlobs, {type: 'video/webm'});
    // video.src = window.URL.createObjectURL(superBuffer);
}

function toggleRecording() {
    if (recordButton.textContent === '錄製') {
      startRecording();
    } else {
      stopRecording();
      recordButton.textContent = '錄製';
      downloadButton.disabled = false;
    }
}

function startRecording() {
    let options = {mimeType: 'video/mp4'};
    recordedBlobs = [];
    try {
        mediaRecorder = new MediaRecorder(stream, options);
    } catch (e0) {
        console.log('Unable to create MediaRecorder with options Object: ', e0);
        try {
        options = {mimeType: 'video/webm,codecs=vp9'};
        mediaRecorder = new MediaRecorder(stream, options);
        } catch (e1) {
            console.log('Unable to create MediaRecorder with options Object: ', e1);
            try {
                options = {mimeType: 'video/vp8'};
                mediaRecorder = new MediaRecorder(stream, options);
            } catch (e2) {
                alert('MediaRecorder is not supported by this browser.\n\n' +
                'Try Firefox 29 or later, or Chrome 47 or later, ' +
                'with Enable experimental Web Platform features enabled from chrome://flags.');
                console.error('Exception while creating MediaRecorder:', e2);
                return;
            }
        }
    }
    console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
    recordButton.textContent = '停止錄製';
    downloadButton.disabled = true;
    mediaRecorder.onstop = handleStop;
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.start(100); // collect 100ms of data
    console.log('MediaRecorder started', mediaRecorder);
}
  
function stopRecording() {
    mediaRecorder.stop();
    console.log('Recorded Blobs: ', recordedBlobs);
    // video.controls = true;
}
  
function handleDataAvailable(event: BlobEvent) {
    if (event.data && event.data.size > 0) {
        recordedBlobs.push(event.data);
    }
}
