// OCR 수행 함수
async function performOCR(imageData) {
    const ocrResult = document.getElementById('ocr-result');
    const ocrResultContainer = document.querySelector('.ocr-result-container');
    const loading = document.getElementById('loading');
    const statusMessage = document.getElementById('status-message');
    
    if (!ocrResult || !ocrResultContainer) {
        console.error('OCR 결과 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 로딩 표시
    if (loading) {
        loading.style.display = 'flex';
    }
    
    try {
        // Tesseract.js 확인
        if (typeof Tesseract === 'undefined') {
            throw new Error('Tesseract.js 라이브러리가 로드되지 않았습니다.');
        }
        
        console.log('OCR 시작... 언어 모델 초기화 중입니다.');
        
        let worker = null;
        
        try {
            // 한국어 모델 시도
            console.log('한국어 모델 로드 시도...');
            worker = await Tesseract.createWorker({
                logger: m => {
                    console.log(`진행: ${m.status}`, `${Math.round(m.progress * 100)}%`);
                }
            });
            
            await worker.loadLanguage('kor');
            await worker.initialize('kor');
            console.log('한국어 모델 로드 성공');
            
        } catch (langError) {
            console.warn('한국어 모델 로드 실패, 영어로 시도합니다:', langError);
            
            if (worker) {
                await worker.terminate();
            }
            
            // 영어로 재시도
            worker = await Tesseract.createWorker({
                logger: m => {
                    console.log(`진행: ${m.status}`, `${Math.round(m.progress * 100)}%`);
                }
            });
            
            await worker.loadLanguage('eng');
            await worker.initialize('eng');
            console.log('영어 모델 로드 성공 (한국어 모델 대체)');
        }
        
        // OCR 수행
        console.log('이미지 인식 시작...');
        const result = await worker.recognize(imageData);
        const text = result.data.text || '';
        
        console.log('OCR 완료. 인식된 텍스트:', text);
        
        await worker.terminate();
        
        // 결과 표시
        if (text.trim()) {
            ocrResult.textContent = text;
            ocrResultContainer.style.display = 'block';
            
            if (typeof updateStatus === 'function') {
                updateStatus('텍스트 인식이 완료되었습니다.', 'success');
            } else if (statusMessage) {
                statusMessage.textContent = '텍스트 인식이 완료되었습니다.';
            }
            
            // 자동으로 읽어주기
            if (typeof speakText === 'function') {
                speakText(text);
            }
        } else {
            ocrResult.textContent = '인식된 텍스트가 없습니다. 다시 촬영해주세요. (너무 작거나 특수 문자가 많을 수 있습니다)';
            ocrResultContainer.style.display = 'block';
            
            if (typeof updateStatus === 'function') {
                updateStatus('텍스트를 인식하지 못했습니다. 더 선명하게 촬영해주세요.', 'error');
            } else if (statusMessage) {
                statusMessage.textContent = '텍스트를 인식하지 못했습니다.';
            }
        }
        
    } catch (error) {
        console.error('OCR 오류:', error);
        console.error('오류 메시지:', error.message);
        console.error('오류 스택:', error.stack);
        
        let errorMsg = '텍스트 인식 중 오류가 발생했습니다.';
        
        if (error.message.includes('404')) {
            errorMsg = '언어 모델을 다운로드할 수 없습니다. 인터넷 연결을 확인해주세요.';
        } else if (error.message.includes('Failed to fetch')) {
            errorMsg = '네트워크 오류입니다. 인터넷 연결을 확인해주세요.';
        } else if (error.message.includes('memory')) {
            errorMsg = '메모리 부족입니다. 페이지를 새로고침해주세요.';
        }
        
        if (typeof updateStatus === 'function') {
            updateStatus(errorMsg, 'error');
        } else if (statusMessage) {
            statusMessage.textContent = errorMsg;
        }
    } finally {
        if (loading) {
            loading.style.display = 'none';
        }
    }
}

// 다시 읽기 버튼
document.addEventListener('DOMContentLoaded', () => {
    const readTextBtn = document.getElementById('read-text-btn');
    const stopReadingBtn = document.getElementById('stop-reading-btn');
    
    if (readTextBtn) {
        readTextBtn.addEventListener('click', () => {
            const text = document.getElementById('ocr-result').textContent;
            if (typeof speakText === 'function') {
                speakText(text);
            }
        });
    }
    
    // 읽기 중지 버튼
    if (stopReadingBtn) {
        stopReadingBtn.addEventListener('click', () => {
            if (typeof stopSpeaking === 'function') {
                stopSpeaking();
            }
        });
    }
});