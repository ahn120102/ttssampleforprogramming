// 전역 변수
let stream = null;
let capturedImageData = null;
let liveGuidanceTimer = null;
let lastGuidanceMessage = '';

// 모든 DOM 작업을 DOMContentLoaded 후에 실행
document.addEventListener('DOMContentLoaded', () => {
    // DOM 요소
    const video = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const capturedImage = document.getElementById('captured-image');
    const statusMessage = document.getElementById('status-message');
    const cameraGuidance = document.getElementById('camera-guidance');
    const startCameraBtn = document.getElementById('start-camera-btn');
    const captureBtn = document.getElementById('capture-btn');
    const stopCameraBtn = document.getElementById('stop-camera-btn');
    const resultContainer = document.querySelector('.result-container');
    const ocrResultContainer = document.querySelector('.ocr-result-container');
    const loading = document.getElementById('loading');
    const imageUpload = document.getElementById('image-upload');
    const uploadBtn = document.getElementById('upload-btn');
    
    // DOM 요소 존재 여부 확인
    if (!video || !canvas || !statusMessage || !startCameraBtn) {
        console.error('필수 DOM 요소를 찾을 수 없습니다.');
        return;
    }
    
    console.log('DOM 요소 로드 완료');

// 상태 메시지 업데이트 함수
function updateStatus(message, type = 'info', shouldSpeak = true) {
    if (statusMessage) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
    }
    
    // 음성 안내
    if (shouldSpeak && typeof speak === 'function') {
        speak(message);
    }
}

function showGuidance(message, type = 'info', shouldSpeak = false) {
    if (cameraGuidance) {
        cameraGuidance.textContent = message;
        cameraGuidance.className = `camera-guidance ${type}`;
    }

    if (shouldSpeak && message && message !== lastGuidanceMessage && typeof speak === 'function') {
        speak(message);
    }

    lastGuidanceMessage = message;
}

function stopLiveGuidance() {
    if (liveGuidanceTimer) {
        clearInterval(liveGuidanceTimer);
        liveGuidanceTimer = null;
    }
}

function analyzeImageForGuidance(canvas) {
    if (!canvas) {
        return null;
    }

    const context = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    if (!context || !width || !height) {
        return null;
    }

    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;

    let darkPixelCount = 0;
    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumYY = 0;
    let sumXY = 0;

    for (let i = 0; i < width * height; i++) {
        const index = i * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const gray = r * 0.299 + g * 0.587 + b * 0.114;

        if (gray < 170) {
            darkPixelCount++;
            const x = i % width;
            const y = Math.floor(i / width);
            sumX += x;
            sumY += y;
            sumXX += x * x;
            sumYY += y * y;
            sumXY += x * y;
        }
    }

    if (darkPixelCount < 80) {
        return {
            message: '문서가 보이지 않습니다. 카메라에 문서를 더 가까이 가져와주세요.',
            type: 'warning'
        };
    }

    const centerX = sumX / darkPixelCount;
    const centerY = sumY / darkPixelCount;
    const relX = centerX / width;
    const relY = centerY / height;
    const margin = 0.12;

    if (relX < margin || relX > 1 - margin || relY < margin || relY > 1 - margin) {
        return {
            message: '문서를 가이드 박스 중앙에 맞추고 촬영해주세요.',
            type: 'warning'
        };
    }

    const covXX = sumXX / darkPixelCount - centerX * centerX;
    const covYY = sumYY / darkPixelCount - centerY * centerY;
    const covXY = sumXY / darkPixelCount - centerX * centerY;
    const angle = 0.5 * Math.atan2(2 * covXY, covXX - covYY) * (180 / Math.PI);
    let deviation = Math.abs(angle);

    if (deviation > 45) {
        deviation = 90 - deviation;
    }

    if (deviation > 8) {
        return {
            message: '문서가 기울어졌을 수 있습니다. 화면을 수평으로 맞춰주세요.',
            type: 'warning'
        };
    }

    return null;
}

function startLiveGuidance(video) {
    stopLiveGuidance();

    liveGuidanceTimer = setInterval(() => {
        if (!video || !video.videoWidth || !video.videoHeight || !video.srcObject) {
            return;
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.min(320, video.videoWidth);
        tempCanvas.height = Math.min(240, video.videoHeight);

        const tempContext = tempCanvas.getContext('2d');
        tempContext.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

        const guidance = analyzeImageForGuidance(tempCanvas);

        if (guidance) {
            if (lastGuidanceMessage !== guidance.message) {
                showGuidance(guidance.message, guidance.type, true);
            }
        } else if (lastGuidanceMessage) {
            showGuidance('문서를 가이드 박스 안에 맞추고, 화면을 수평으로 맞춰주세요.', 'info');
        }
    }, 2000);
}

// 카메라 시작
startCameraBtn.addEventListener('click', async () => {
    try {
        updateStatus('카메라를 시작하는 중입니다...', 'warning');
        
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment', // 후면 카메라
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });
        
        video.srcObject = stream;
        await video.play().catch(() => {});
        startLiveGuidance(video);
        
        // 버튼 상태 변경
        startCameraBtn.disabled = true;
        captureBtn.disabled = false;
        stopCameraBtn.disabled = false;
        
        updateStatus('카메라가 시작되었습니다. 문서를 가이드 박스 안에 맞춰주세요.', 'success');
        
    } catch (error) {
        console.error('카메라 오류:', error);
        updateStatus('카메라를 시작할 수 없습니다. 권한을 확인해주세요.', 'error');
    }
});

// 사진 촬영
captureBtn.addEventListener('click', () => {
    const context = canvas.getContext('2d');
    
    // 캔버스 크기를 비디오 크기에 맞춤
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // 비디오 프레임을 캔버스에 그리기
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // 이미지 데이터 저장
    capturedImageData = canvas.toDataURL('image/jpeg', 0.9);
    
    // 촬영된 이미지 표시
    capturedImage.src = capturedImageData;
    resultContainer.style.display = 'block';

    const guidance = analyzeImageForGuidance(canvas);
    if (guidance) {
        updateStatus(guidance.message, 'warning', true);
    } else {
        updateStatus('사진이 촬영되었습니다. 텍스트를 인식하는 중...', 'success');
    }
    
    // OCR 처리
    if (typeof performOCR === 'function') {
        performOCR(capturedImageData);
    } else {
        updateStatus('OCR 함수를 찾을 수 없습니다.', 'error');
        console.error('performOCR 함수가 정의되지 않았습니다.');
    }
});

// 카메라 중지
stopCameraBtn.addEventListener('click', () => {
    if (stream) {
        stopLiveGuidance();
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        stream = null;
        
        // 버튼 상태 변경
        startCameraBtn.disabled = false;
        captureBtn.disabled = true;
        stopCameraBtn.disabled = true;
        
        updateStatus('카메라가 종료되었습니다.', 'info');
    }
});

// 파일 업로드 (요소가 존재할 때만)
if (uploadBtn && imageUpload) {
    uploadBtn.addEventListener('click', () => {
        imageUpload.click();
    });

    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            // 파일이 이미지 형식인지 확인
            if (!file.type.startsWith('image/')) {
                updateStatus('이미지 파일을 선택해주세요.', 'error');
                return;
            }
            
            // 파일을 Data URL로 변환
            const reader = new FileReader();
            reader.onload = (event) => {
                capturedImageData = event.target.result;
                
                // 업로드된 이미지 표시
                capturedImage.src = capturedImageData;
                resultContainer.style.display = 'block';
                
                updateStatus('이미지가 업로드되었습니다. 텍스트를 인식하는 중...', 'success');
                
                // OCR 처리
                if (typeof performOCR === 'function') {
                    performOCR(capturedImageData);
                } else {
                    updateStatus('OCR 함수를 찾을 수 없습니다.', 'error');
                    console.error('performOCR 함수가 정의되지 않았습니다.');
                }
            };
            reader.readAsDataURL(file);
        }
    });
}

// 다시 읽기 버튼 (요소가 존재할 때만)
const readTextBtn = document.getElementById('read-text-btn');
if (readTextBtn) {
    readTextBtn.addEventListener('click', () => {
        const text = document.getElementById('ocr-result').textContent;
        if (typeof speakText === 'function') {
            speakText(text);
        }
    });
}

// 읽기 중지 버튼 (요소가 존재할 때만)
const stopReadingBtn = document.getElementById('stop-reading-btn');
if (stopReadingBtn) {
    stopReadingBtn.addEventListener('click', () => {
        if (typeof stopSpeaking === 'function') {
            stopSpeaking();
        }
    });
}

    // 페이지 로드 시 음성 안내
    if (typeof speak === 'function') {
        speak('시각장애인용 문서 읽기 도우미입니다. 카메라 시작 버튼을 눌러주세요.');
    }

    if (cameraGuidance) {
        showGuidance('문서를 가이드 박스 안에 맞추고, 화면을 수평으로 맞춰주세요.', 'info');
    }
});

// 페이지 종료 시 카메라 정리
window.addEventListener('beforeunload', () => {
    stopLiveGuidance();
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});