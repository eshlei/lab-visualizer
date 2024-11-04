const video = document.getElementById('camera');
const canvasWrapper = document.getElementById('canvas-wrapper');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });
const analysis = document.getElementById('analysis');
const lPlot = document.getElementById('l-plot');
const centerPixelL = document.getElementById('center-pixel-l');
const abPlot = document.getElementById('ab-plot');
const centerPixelAb = document.getElementById('center-pixel-ab');
const svgText = document.getElementById('svg-text');
const svgTextL = document.getElementById('svg-text-l');
const svgTextA = document.getElementById('svg-text-a');
const svgTextB = document.getElementById('svg-text-b');
const captureButton = document.getElementById('capture-button');
const overlayBackground = document.getElementById('overlay-background');
const overlayOption = document.getElementById('overlay-option');

const sampleWidth = 10;
const recentSamplesLen = 5;
var recentSamples = [];

const abPlotRad = 44;
const lPlotMin = 20;
const lPlotMax = 80;

class StandardObserver {
    constructor(whiteX = 0.95047, whiteY = 1.00000, whiteZ = 1.08883) {
        this.d65WhiteX = 0.95047;
        this.d65WhiteY = 1.00000;
        this.d65WhiteZ = 1.08883;
        this.whiteX = whiteX;
        this.whiteY = whiteY;
        this.whiteZ = whiteZ;
    }

    setReferenceWhite(whiteX, whiteY, whiteZ) {
        this.whiteX = whiteX;
        this.whiteY = whiteY;
        this.whiteZ = whiteZ;
    }
    
    rgbToXyz(r, g, b) {
        // Convert RGB to a range of [0, 1]
        r /= 255;
        g /= 255;
        b /= 255;
    
        // Apply gamma correction
        r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
        g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
        b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
        
        // Convert to XYZ using the D65 illuminant
        const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
        const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
        const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

        return { x, y, z };
    }

    xyzToLab(x, y, z) {
        // Normalize by reference white
        x /= this.whiteX;
        y /= this.whiteY;
        z /= this.whiteZ;
    
        // Convert XYZ to Lab
        x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + (16 / 116);
        y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + (16 / 116);
        z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + (16 / 116);
    
        // Rescale and translate
        const l = (116 * y) - 16;
        const a = 500 * (x - y);
        const b = 200 * (y - z);
    
        return { l, a, b };
    }

    xyzToRgb(x, y, z) {
        // Convert XYZ to linear RGB
        let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
        let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
        let b = x * 0.0557 + y * -0.2040 + z * 1.0570;

        // Apply gamma correction
        r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
        g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
        b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

        // Clip the values to [0, 1] range
        r = Math.max(0, Math.min(1, r));
        g = Math.max(0, Math.min(1, g));
        b = Math.max(0, Math.min(1, b));

        // Convert to [0, 255] range
        r = Math.round(r * 255);
        g = Math.round(g * 255);
        b = Math.round(b * 255);

        return { r, g, b };
    }

    labToXyz(l, a, b) {
        // Rescale and translate
        const y = (l + 16) / 116;
        const x = a / 500 + y;
        const z = y - b / 200;

        // Compute intermediate values
        const x3 = Math.pow(x, 3);
        const y3 = Math.pow(y, 3);
        const z3 = Math.pow(z, 3);

        // Convert to reference white
        let xr = x3 > 0.008856 ? x3 : (x - 16 / 116) / 7.787;
        let yr = y3 > 0.008856 ? y3 : (y - 16 / 116) / 7.787;
        let zr = z3 > 0.008856 ? z3 : (z - 16 / 116) / 7.787;
        
        // De-normalize by reference white
        xr *= this.whiteX;
        yr *= this.whiteY;
        zr *= this.whiteZ;

        return { x: xr, y: yr, z: zr };
    }

    labToRgb(l, a, b) {
        const xyz = this.labToXyz(l, a, b);
        const rgb = this.xyzToRgb(xyz.x, xyz.y, xyz.z);
        return rgb;
    }
    
    rgbToLab(r, g, b) {
        const xyz = this.rgbToXyz(r, g, b);
        const lab = this.xyzToLab(xyz.x, xyz.y, xyz.z);
        return lab;
    }
}
const envObserver = new StandardObserver();
const d65Observer = new StandardObserver();


// Update canvas with video feed
function updateCanvas() {
    // Mease canvas and video dimensions
    const canvasWidth = canvas.offsetWidth;
    const canvasHeight = canvas.offsetHeight;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Update canvas
    var scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
    sWidth = canvasWidth / scale;
    sHeight = canvasHeight / scale;
    sx = (videoWidth - sWidth) / 2;
    sy = (videoHeight - sHeight) / 2;
    context.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvasWidth, canvasHeight);

    // Redraw rectangle
    context.beginPath();
    context.rect(canvasWidth / 2 - sampleWidth / 2, canvasHeight / 2 - sampleWidth / 2, sampleWidth, sampleWidth);
    context.stroke();
}

// Get RGB values of a pixel
function getPixel(x, y) {
    const data = context.getImageData(x - sampleWidth / 2, y - sampleWidth / 2, sampleWidth, sampleWidth).data;
    
    const pixelCount = sampleWidth * sampleWidth;
    var meanRgb = { r: 0, g: 0, b: 0 };
    for (let i = 0; i < pixelCount; i++) {
        meanRgb.r += data[4 * i];
        meanRgb.g += data[4 * i + 1];
        meanRgb.b += data[4 * i + 2];
    }
    meanRgb.r /= pixelCount;
    meanRgb.g /= pixelCount;
    meanRgb.b /= pixelCount;
    return {r: meanRgb.r, g: meanRgb.g, b: meanRgb.b };
}

// Convert to l-plot coords
function labToLPlot(l, a, b) {
    const x = 5;
    const y = lPlotMax - l / 100 * (lPlotMax - lPlotMin)
    return { x, y };
}

// Convert to ab-plot coords
function labToAbPlot(l, a, b) {
    const x = 50 + a / 100 * abPlotRad;
    const y = 50 - b / 100 * abPlotRad;
    return { x, y };
}

setInterval(() => {
    // Update canvas using video feed
    updateCanvas();

    // Get center pixel and map to Lab
    const envRgb = getPixel(canvas.offsetWidth / 2, canvas.offsetHeight / 2);
    const envLab = envObserver.rgbToLab(envRgb.r, envRgb.g, envRgb.b);

    // Push to queue and calculate mean
    recentSamples.push(envLab);
    if (recentSamples.length > recentSamplesLen) {
        recentSamples.shift();
    }
    let meanLab = { l: 0, a: 0, b: 0 };
    for (let idx in recentSamples) {
        meanLab.l += recentSamples[idx].l;
        meanLab.a += recentSamples[idx].a;
        meanLab.b += recentSamples[idx].b;
    }
    meanLab.l /= recentSamplesLen;
    meanLab.a /= recentSamplesLen;
    meanLab.b /= recentSamplesLen;
    const meanRgb = d65Observer.labToRgb(meanLab.l, meanLab.a, meanLab.b);
    
    // Update l-plot
    const lPlotCoords = labToLPlot(meanLab.l, meanLab.a, meanLab.b);
    centerPixelL.setAttribute('y1', lPlotCoords.y);
    centerPixelL.setAttribute('y2', lPlotCoords.y);
    centerPixelL.setAttribute('stroke', `RGB(${meanRgb.r},${meanRgb.g},${meanRgb.b})`);
    svgTextL.textContent = '\u00A0'.repeat(Math.max(0, 2 - `${Math.round(meanLab.l)}`.length)) + Math.round(meanLab.l);

    // Update ab-plot
    const AbPlotCoords = labToAbPlot(meanLab.l, meanLab.a, meanLab.b);
    centerPixelAb.setAttribute('cx', AbPlotCoords.x);
    centerPixelAb.setAttribute('cy', AbPlotCoords.y);
    centerPixelAb.setAttribute('fill', `RGB(${meanRgb.r},${meanRgb.g},${meanRgb.b})`);
    svgTextA.textContent = '\u00A0'.repeat(Math.max(0, 3 - `${Math.round(meanLab.a)}`.length)) + Math.round(meanLab.a);
    svgTextB.textContent = '\u00A0'.repeat(Math.max(0, 3 - `${Math.round(meanLab.b)}`.length)) + Math.round(meanLab.b);
    // svgText.textContent = `L*:${Math.round(meanLab.l)}, a*:${Math.round(meanLab.a)}, b*:${Math.round(meanLab.b)}`;
}, 40);

// Capture color
function capture() {
    const envRgb = getPixel(canvas.offsetWidth / 2, canvas.offsetHeight / 2);
    const envLab = envObserver.rgbToLab(envRgb.r, envRgb.g, envRgb.b);
    const d65Rgb = d65Observer.labToRgb(envLab.l, envLab.a, envLab.b);
    const lPlotCoords = labToLPlot(envLab.l, envLab.a, envLab.b);
    const abPlotCoords = labToAbPlot(envLab.l, envLab.a, envLab.b);

    // console.log(`(${Math.round(envRgb.r)}, ${Math.round(envRgb.g)}, ${Math.round(envRgb.b)}), (${Math.round(envLab.l)}, ${Math.round(envLab.a)}, ${Math.round(envLab.b)})`);

    // Add new color to l-plot
    const capturedColorL = document.createElementNS("http://www.w3.org/2000/svg", 'line');
    capturedColorL.setAttribute('class', 'captured-color-l');
    capturedColorL.setAttribute('x1', 7);
    capturedColorL.setAttribute('y1', lPlotCoords.y);
    capturedColorL.setAttribute('x2', 13);
    capturedColorL.setAttribute('y2', lPlotCoords.y);
    capturedColorL.setAttribute('stroke', `RGB(${d65Rgb.r},${d65Rgb.g},${d65Rgb.b})`);
    capturedColorL.setAttribute('stroke-width', 1.5);
    capturedColorL.setAttribute('stroke-linecap', 'round');
    lPlot.insertBefore(capturedColorL, centerPixelL);

    // Add new color to ab-plot
    const capturedColorAb = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
    capturedColorAb.setAttribute('class', 'captured-color-ab');
    capturedColorAb.setAttribute('width', 10);
    capturedColorAb.setAttribute('height', 1);
    capturedColorAb.setAttribute('cx', abPlotCoords.x);
    capturedColorAb.setAttribute('cy', abPlotCoords.y);
    capturedColorAb.setAttribute('r', 1.5);
    capturedColorAb.setAttribute('fill', `RGB(${d65Rgb.r},${d65Rgb.g},${d65Rgb.b})`);
    abPlot.insertBefore(capturedColorAb, centerPixelAb);
}
var intervalId = null;
captureButton.addEventListener("mousedown", (e) => {
    canvasWrapper.style.background = '#909090';
    capture();
    intervalId = setInterval(() => {
        capture();
        clearInterval(intervalId);
        intervalId = setInterval(capture, 100, 'capture');
    }, 250, 'capture');
});
captureButton.addEventListener("mouseup", (e) => {
    clearInterval(intervalId);
    canvasWrapper.style.background = '#f0f0f0';
});

// Filter by lightness or hue
function filterByLightness (e) {
    e.preventDefault();
    e.stopPropagation();
    const capturedColorsL = document.getElementsByClassName("captured-color-l");
    const capturedColorsAb = document.getElementsByClassName("captured-color-ab");
    let lBounds = lPlot.getBoundingClientRect();
    let mouseY = e.touches ? e.touches[0].clientY : e.clientY;
    mouseY = (mouseY - lBounds.top) / (lBounds.bottom - lBounds.top) * 100;
    for (let i = 0; i < capturedColorsL.length; i++) {
        let capturedY = parseFloat(capturedColorsL[i].getAttribute('y1'));
        if (capturedY < mouseY) {
            capturedColorsL[i].style.display = null;
            capturedColorsAb[i].style.display = null;
        } else {
            capturedColorsL[i].style.display = 'none';
            capturedColorsAb[i].style.display = 'none';
        }
    }
}
function filterByHue (e) {
    e.preventDefault();
    e.stopPropagation();
    const capturedColorsL = document.getElementsByClassName("captured-color-l");
    const capturedColorsAb = document.getElementsByClassName("captured-color-ab");
    let abBounds = abPlot.getBoundingClientRect();
    let mouseX = e.touches ? e.touches[0].clientX : e.clientX;
    let mouseY = e.touches ? e.touches[0].clientY : e.clientY;
    mouseX = (mouseX - abBounds.left) / (abBounds.right - abBounds.left) * 100;
    mouseY = (mouseY - abBounds.top) / (abBounds.bottom - abBounds.top) * 100;
    let mouseA = (mouseX - 50) / abPlotRad * 100;
    let mouseB = (50 - mouseY) / abPlotRad * 100;
    let mouseHue = Math.atan2(mouseB, mouseA);
    let mouseChroma = Math.sqrt(mouseA ** 2 + mouseB ** 2);
    let hueFilterWindow = Math.PI / 6;
    if (mouseChroma >= 100 && mouseChroma < 125) {
        hueFilterWindow = hueFilterWindow - 0.5 * hueFilterWindow * ((mouseChroma - 100) / 100 * 4) ** 2;
    } else if (mouseChroma >= 125) {
        hueFilterWindow = Math.max(0, -hueFilterWindow * 2 * (mouseChroma / 100 - 1.25) + hueFilterWindow / 2);
    }
    // console.log(mouseChroma, Math.PI / hueFilterWindow);
    for (let i = 0; i < capturedColorsL.length; i++) {
        let capturedX = parseFloat(capturedColorsAb[i].getAttribute('cx'));
        let capturedY = parseFloat(capturedColorsAb[i].getAttribute('cy'));
        let capturedHue = Math.atan2(50 - capturedY, capturedX - 50);
        if ((mouseHue - hueFilterWindow <= capturedHue && capturedHue <= mouseHue + hueFilterWindow)
            || (mouseHue - hueFilterWindow <= capturedHue + 2 * Math.PI && capturedHue + 2 * Math.PI <= mouseHue + hueFilterWindow)
            || (mouseHue - hueFilterWindow + 2 * Math.PI <= capturedHue && capturedHue <= mouseHue + hueFilterWindow + 2 * Math.PI)) {
            capturedColorsL[i].style.display = null;
        } else {
            capturedColorsL[i].style.display = 'none';
        }
    }
    const filterWindowAb = document.getElementById("filter-window-ab");
    let arcRx = abPlotRad + 1.5;
    let arcRy = abPlotRad + 1.5;
    let arcX1 = 50 + Math.cos(mouseHue - hueFilterWindow) * arcRx;
    let arcY1 = 50 - Math.sin(mouseHue - hueFilterWindow) * arcRy;
    let arcX2 = 50 + Math.cos(mouseHue + hueFilterWindow) * arcRx;
    let arcY2 = 50 - Math.sin(mouseHue + hueFilterWindow) * arcRy;
    filterWindowAb.setAttribute('d', `M 50 50 ${arcX1} ${arcY1} A ${arcRx} ${arcRy} 0 0 0 ${arcX2} ${arcY2} M 50 50 Z`);
    filterWindowAb.style.display = null;
}
function filterReset(e) {
    const capturedColorsL = document.getElementsByClassName("captured-color-l");
    const capturedColorsAb = document.getElementsByClassName("captured-color-ab");
    const filterWindowAb = document.getElementById("filter-window-ab");
    for (let i = 0; i < capturedColorsL.length; i++) {
        capturedColorsL[i].style.display = null;
        capturedColorsAb[i].style.display = null;
    }
    filterWindowAb.style.display = 'none';
}
lPlot.addEventListener("mousestart", filterByLightness);
lPlot.addEventListener("mousemove", filterByLightness);
lPlot.addEventListener("mouseleave", filterReset);
lPlot.addEventListener("touchcancel", filterReset);
lPlot.addEventListener("touchstart", filterByLightness);
lPlot.addEventListener("touchmove", filterByLightness);
lPlot.addEventListener("touchend", filterReset);
lPlot.addEventListener("touchcancel", filterReset);
abPlot.addEventListener("mousestart", filterByHue);
abPlot.addEventListener("mousemove", filterByHue);
abPlot.addEventListener("mouseleave", filterReset);
abPlot.addEventListener("touchcancel", filterReset);
abPlot.addEventListener("touchstart", filterByHue);
abPlot.addEventListener("touchmove", filterByHue);
abPlot.addEventListener("touchend", filterReset);
abPlot.addEventListener("touchcancel", filterReset);


// Set reference white
canvas.addEventListener("click", () => {
    const rgb = getPixel(canvas.offsetWidth / 2, canvas.offsetHeight / 2);
    const xyz = envObserver.rgbToXyz(rgb.r, rgb.g, rgb.b);
    
    // Set reference white
    envObserver.setReferenceWhite(xyz.x, xyz.y, xyz.z);

    // Visual cues for reference white reset
    canvasWrapper.style.background = "#909090";
    setTimeout(() => {
        canvasWrapper.style.background = "#f0f0f0";
    }, 250);
});

// Click blank to remove most recent captures
abPlot.addEventListener("click", () => {
    const capturedColorsL = document.getElementsByClassName("captured-color-l");
    const capturedColorsAb = document.getElementsByClassName("captured-color-ab");
    capturedColorsL[capturedColorsL.length - 1].remove();
    capturedColorsAb[capturedColorsAb.length - 1].remove();
});

// Request camera access
document.addEventListener('DOMContentLoaded', () => {
    overlayOption.addEventListener('click', () => {
        // Request camera access
        navigator.mediaDevices.getUserMedia({video: {facingMode: {exact: 'environment'}}})
        .then(stream => {
            video.srcObject = stream;
            video.play();
        })
        .catch(() => {
            navigator.mediaDevices.getUserMedia({video: true})
            .then(stream => {
                video.srcObject = stream;
                video.play();
            })
        })
        .catch(err => {
            alert('Error accessing the camera: ', err);
        })
        
        // Set canvas size
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // Hide overlay
        overlayBackground.style.display = 'none';
    }, { once: true });
});
