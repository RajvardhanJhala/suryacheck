FROM public.ecr.aws/lambda/python:3.13

RUN pip install --no-cache-dir onnxruntime numpy pillow

# Build context is the repo root (see .dockerignore). Model: CLIP ViT-B/32 quantized ONNX
# (OpenAI, MIT; ONNX export by Xenova), fetched by ml/build_heads.py.
COPY backend/vision/ ${LAMBDA_TASK_ROOT}/vision/
COPY ml/models/clip/onnx/vision_model_quantized.onnx ${LAMBDA_TASK_ROOT}/vision/models/vision_model_quantized.onnx

CMD ["vision.handler.handler"]
