FROM public.ecr.aws/lambda/python:3.13

COPY agent/requirements.txt ${LAMBDA_TASK_ROOT}/agent/requirements.txt
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/agent/requirements.txt

COPY physics/ ${LAMBDA_TASK_ROOT}/physics/
COPY shared/ ${LAMBDA_TASK_ROOT}/shared/
COPY policies/ ${LAMBDA_TASK_ROOT}/policies/
COPY agent/ ${LAMBDA_TASK_ROOT}/agent/

CMD ["agent.handler.handler"]
