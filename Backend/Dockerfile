FROM python:3.9-slim

WORKDIR /app

# Install dependencies directly (since requirements.txt might not exist yet)
# Ideally we should COPY requirements.txt . && RUN pip install -r requirements.txt
# But for robustness in this guide, we'll install widely used packages + user installed ones.
RUN pip install --no-cache-dir fastapi uvicorn websockets motor python-multipart

COPY . .

# Expose port (Internal Docker network port)
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
