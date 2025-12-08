# HOUFIT

## 코드 실행 방법
1. https://houfit.netlify.app/ 접속
2. GLTF 모델 로딩 완료되면, 체형 조절
3. 입어보기 탭 클릭
4. 옷 사진 업로드 (모델이 입고 있거나, 상하의 코디가 모두 되어 있는 옷)
5. 가상 피팅 이미지 생성
    - google cloud run에 업로드 된 백엔드 서버로 모델과 옷 사진 전송됨
    - 백엔드 서버에서 FASHN ai로 두 사진 전송됨
    - FASHN ai에서 합성 이미지 생성 완료 후 프론트로 output이 전송됨
6. 후기 및 피드백 제출

## 개발자 용 편집 방법
1. package.json생성 및 라이브러리 설치
    `npm install`
    `npm init -y`
    `npm install dotenv express multer cors axios`
