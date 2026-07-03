// TTS 함수 (짧은 안내용)
function speak(text) {
    // 기존 음성 중지
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    window.speechSynthesis.speak(utterance);
}

// TTS 함수 (긴 텍스트용)
function speakText(text) {
    // 기존 음성 중지
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.9; // 조금 천천히
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // 읽기 시작 이벤트
    utterance.onstart = () => {
        updateStatus('텍스트를 읽고 있습니다...', 'info');
    };
    
    // 읽기 완료 이벤트
    utterance.onend = () => {
        updateStatus('텍스트 읽기가 완료되었습니다.', 'success');
    };
    
    // 오류 처리
    utterance.onerror = (event) => {
        console.error('TTS 오류:', event);
        updateStatus('음성 출력 중 오류가 발생했습니다.', 'error');
    };
    
    window.speechSynthesis.speak(utterance);
}

// 음성 중지 함수
function stopSpeaking() {
    window.speechSynthesis.cancel();
    updateStatus('음성 출력이 중지되었습니다.', 'info');
}