// app.js
const video = document.getElementById('camera');
const plot = document.getElementById('plot');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });

// Request camera access
navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
        video.play();
    })
    .catch(err => {
        console.error('Error accessing the camera: ', err);
    });

// Function to capture the center pixel color
function captureColor() {

    const canvasWidth = canvas.offsetWidth;
    const canvasHeight = canvas.offsetHeight;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Crop the video
    var scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
    sWidth = canvasWidth / scale;
    sHeight = canvasHeight / scale;
    sx = (videoWidth - sWidth) / 2;
    sy = (videoHeight - sHeight) / 2;

    console.log(scale)
    console.log(canvasWidth, canvasHeight, videoWidth, videoHeight)
    console.log(sx, sWidth, sy, sHeight)

    context.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvasWidth, canvasHeight);

    // Get the center pixel
    const centerX = Math.floor(videoWidth / 2);
    const centerY = Math.floor(videoHeight / 2);
    const imageData = context.getImageData(centerX, centerY, 1, 1).data;
    const [r, g, b] = imageData;

    return { r, g, b };
}

// Update the color periodically
setInterval(() => {
    const { r, g, b } = captureColor();
    const lab = chroma.rgb(r, g, b).lab();

    // Update the plot div
    plot.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    plot.innerText = `L: ${lab[0].toFixed(2)}, a: ${lab[1].toFixed(2)}, b: ${lab[2].toFixed(2)}`;
}, 1000);
