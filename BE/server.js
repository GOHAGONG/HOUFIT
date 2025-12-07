// server.js
require('dotenv').config(); 
const express = require('express');
const multer = require('multer');
const cors = require('cors'); 
const axios = require('axios'); // 외부 API 호출을 위해 axios 필요

// --- 1. Fashn.ai 설정 및 환경 변수 확인 ---

// 💡 수정 없음: Fashn.ai API 엔드포인트는 /v1/run 유지
const FASHN_API_URL = 'https://api.fashn.ai/v1/run'; 
const FASHN_API_KEY = process.env.FASHN_API_KEY;
const FASHN_MODEL_NAME = 'tryon-v1.6'; 

const app = express();
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Multer 설정: 메모리에 파일 버퍼로 저장
const upload = multer({ storage: multer.memoryStorage() });

// CORS 설정
app.use(cors()); 
app.use(express.json({ limit: '10mb' })); // Base64 데이터 전송을 위해 크기 제한을 늘립니다.
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- 환경 변수 필수 확인 ---
if (!FASHN_API_KEY) {
    console.error("❌ 오류: FASHN_API_KEY 환경 변수가 설정되어야 합니다. .env 파일을 확인해주세요.");
    process.exit(1); 
}
// --- 환경 변수 필수 확인 끝 ---

/**
 * 이미지 버퍼와 MIME 타입을 받아 Base64 문자열 자체를 반환합니다.
 * @returns {string} Pure Base64 Data String (MIME Type Prefix 없음)
 */
function fileToBase64String(imageBuffer, mimeType) {
  // 디버깅을 위해 파일 크기를 콘솔에 출력
  console.log(`[Base64] File size: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB, MIME: ${mimeType}`);
  
  // Base64 Data URL 형식: data:[<MIME-type>][;charset=<encoding>][;base64],<data>
  const base64Data = imageBuffer.toString("base64");
  return `data:${mimeType};base64,${base64Data}`;
}

/**
 * Fashn.ai API를 호출하여 최종 합성 이미지를 생성합니다. (비동기 폴링 로직 포함)
 */
async function callFashnAPI(modelBase64, garmentBase64) {
    const requestBody = {
        model_name: FASHN_MODEL_NAME, // 'tryon-v1.6'
        inputs: {
            model_image: modelBase64,   
            garment_image: garmentBase64,
        },
    };
    
    // API 호출을 위한 기본 헤더 설정
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FASHN_API_KEY}` 
    };

    console.log('[Fashn.ai] 1단계: 작업 제출 (Run) 시작...');

    try {
        // 1. 작업 제출 (Run)
        const runResponse = await axios.post(FASHN_API_URL, requestBody, { headers });
        const predictionId = runResponse.data.id;
        
        if (!predictionId) {
            console.error('Run 응답 데이터:', runResponse.data);
            throw new Error('Fashn.ai로부터 작업 ID를 받지 못했습니다. (비동기 응답 예상)');
        }

        console.log(`[Fashn.ai] 작업 ID: ${predictionId}. 2단계: 상태 폴링 시작...`);

        // 2. 비동기 상태 폴링 (Polling)
        let finalImageBase64 = null;
        let isCompleted = false;
        const POLL_INTERVAL = 5000; // 5초 간격
        const MAX_POLLS = 24; // 최대 2분 대기 (24 * 5초)

        for (let i = 0; i < MAX_POLLS && !isCompleted; i++) {
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

            const statusUrl = `https://api.fashn.ai/v1/status/${predictionId}`;
            const statusResponse = await axios.get(statusUrl, { headers });
            const statusData = statusResponse.data;
            const status = statusData.status;

            console.log(`[Fashn.ai] 폴링 ${i + 1}/${MAX_POLLS}, 상태: ${status}`);

            if (status === 'completed') {
                // 이미지가 완료된 경우, result 필드에서 Base64 데이터 추출
                finalImageBase64 = statusData.result?.base64_image || statusData.result?.image;
                
                // output URL 받음
                if (statusData.output && statusData.output.length > 0) {
                    finalImageUrl = statusData.output[0]; 
                }

                isCompleted = true;
                break; // 💡 수정됨: 완료되면 즉시 루프 종료
            } else if (status === 'failed' || status === 'canceled') {
                // 작업 실패 처리
                throw new Error(`Fashn.ai 작업 실패. 상태: ${status}, 오류 메시: ${statusData.error || 'N/A'}`);
            }
        }

        if (!isCompleted) {
            throw new Error('Fashn.ai 작업이 시간 내에 완료되지 않았습니다. (Timeout)');
        }
        
        // 3. 최종 URL 다운로드 및 Base64 변환
        if (!finalImageUrl) {
            throw new Error('Fashn.ai 작업 완료 후 최종 이미지 URL을 찾을 수 없습니다.');
        }

        console.log(`[Fashn.ai] 최종 이미지 URL 다운로드 시작: ${finalImageUrl}`);
        
        // URL로 이미지를 다운로드 (ArrayBuffer)
        const imageResponse = await axios.get(finalImageUrl, { responseType: 'arraybuffer' });
        
        // ArrayBuffer를 Base64로 인코딩하여 프론트엔드에 전달
        finalImageBase64 = Buffer.from(imageResponse.data).toString('base64');

        return finalImageBase64; 

    } catch (error) {
        // 오류 상세 정보 출력
        const status = error.response ? error.response.status : 'N/A';
        const data = error.response ? JSON.stringify(error.response.data) : error.message;
        
        console.error(`Fashn.ai API 호출 오류 [Status: ${status}]:`, data);
        
        if (status === 401 || status === 403) {
             throw new Error("Fashn.ai 인증 실패: API 키 또는 크레딧 상태를 확인하세요.");
        }
        if (status === 429) {
             throw new Error("Fashn.ai 쿼터 초과: 잠시 후 다시 시도하거나 플랜을 확인하세요.");
        }
        throw new Error(`Fashn.ai API 통신 실패: ${data}`);
    }
}


// --- 2. 최종 엔드포인트 로직 (Fashn.ai VTO 모드) ---

app.post('/vto', upload.array('images', 2), async (req, res) => {
  if (!req.files || req.files.length !== 2) {
    return res.status(400).send({ error: '모델 사진과 옷 사진, 총 2장의 이미지가 필요합니다.' });
  }

  // 1. 입력 데이터 추출
  const modelImage = req.files[0];
  const garmentImage = req.files[1];

  try {
    // 2. Base64 인코딩 (순수 문자열)
    const modelBase64 = fileToBase64String(modelImage.buffer, modelImage.mimetype);
    const garmentBase64 = fileToBase64String(garmentImage.buffer, garmentImage.mimetype);

    // 3. Fashn.ai API 호출 (폴링 포함)
    console.log('[VTO] Fashn.ai 합성 시작...');
    const finalImageBase64 = await callFashnAPI(modelBase64, garmentBase64);
    console.log('[VTO] Fashn.ai 합성 성공.');

    // 4. 최종 응답
    res.json({
      message: 'Fashn.ai 가상 착용 이미지가 성공적으로 생성되었습니다.',
      finalImage: finalImageBase64 
    });

  } catch (error) {
    // API 처리 중 오류 메시지 상세 출력
    const errorMessage = error.message;
    console.error('API 처리 중 오류 발생:', errorMessage);
    
    // 클라이언트에게 500 에러와 메시지 전달
    res.status(500).send({ error: `VTO 처리 오류: ${errorMessage}` });
  }
});