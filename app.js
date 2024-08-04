const video = document.getElementById('camera');
const analysisContainer = document.getElementById('analysis-container');
const analysis = document.getElementById('analysis');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });
const centerPixel = document.getElementById('center-pixel')
const sampleWindow = 10;

// Request camera access
navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
        video.play();
    })
    .catch(err => {
        console.error('Error accessing the camera: ', err);
    });

// Update canvas with video feed
function updateCanvas() {
    // Remeasure canvas and video width
    const canvasWidth = canvas.offsetWidth;
    const canvasHeight = canvas.offsetHeight;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Update canvas
    var scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
    sWidth = canvasWidth / scale;
    sHeight = canvasHeight / scale;
    sx = (videoWidth - sWidth) / 2;
    sy = (videoHeight - sHeight) / 2;
    context.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvasWidth, canvasHeight);

    // Redraw circle
    context.beginPath();
    context.rect(canvasWidth / 2 - 5, canvasHeight / 2 - 5, 10, 10);
    context.stroke();
}

// Get RGB values of a pixel
function getPixel(x, y) {
    const data = context.getImageData(x - sampleWindow / 2, y - sampleWindow / 2, sampleWindow, sampleWindow).data;
    
    var [ r, g, b ] = [ 0, 0, 0 ];
    const pixelCount = sampleWindow * sampleWindow;
    for (let i = 0; i < pixelCount; i++) {
        r += data[4 * i];
        g += data[4 * i + 1];
        b += data[4 * i + 2];
    }
    console.log(r / pixelCount, g / pixelCount, b / pixelCount);
    return [ r / pixelCount, g / pixelCount, b / pixelCount ];
}

function plotPixel(labL, labA, labB, colorCode) {
    const canvasCoordsMax = 44;
    const abMax = 50;
    const abToCanvasCoords = canvasCoordsMax / abMax;
    centerPixel.style.cx = 50 + labA * abToCanvasCoords;
    centerPixel.style.cy = 50 - labB * abToCanvasCoords;
    centerPixel.style.fill = colorCode;
}

setInterval(() => {
    const centerX = Math.floor(canvas.offsetWidth / 2);
    const centerY = Math.floor(canvas.offsetHeight / 2);

    // Update canvas using video feed
    updateCanvas();

    // Get center pixel and map to CIELab
    const [ r, g, b ] = getPixel(centerX, centerY);
    console.log(r, g, b);
    const lab = chroma.rgb(r, g, b).lab();
    const labL = lab[0];
    const labA = lab[1];
    const labB = lab[2];

    // Update plot
    plotPixel(labL, labA, labB, `RGB(${r},${g},${b})`);

    console.log(`(${centerPixel.style.cx}, ${centerPixel.style.cx})`);

    // console.log(`L: ${labL.toFixed(2)}, a: ${labA.toFixed(2)}, b: ${labB.toFixed(2)}`);
}, 100);

window.onresize = () => {
    canvasWidth = canvas.offsetWidth;
    canvasHeight = canvas.offsetHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
}