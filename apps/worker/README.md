# OSES Worker — Python OpenCV Service

## Status

Placeholder. Not yet implemented.

## What this service will do

This service consumes jobs from AWS SQS that are pushed
by the NestJS API when a school uploads scanned answer sheets.

Pipeline:
1. Poll AWS SQS for scan_batch messages
2. Download raw scan file from AWS S3
3. OpenCV: deskew each page (correct rotation)
4. pyzbar: read QR code → match to answer_sheets.qr_identifier
5. OpenCV: crop each question region using coordinates from questions table
6. Save cropped images to S3
7. Write exam.answer_segments rows to PostgreSQL
8. Update scan_batch status to complete

## Tech stack (when implemented)

- Python 3.11
- opencv-python
- pyzbar
- boto3 (AWS SDK)
- psycopg2 (PostgreSQL)
- pydantic (message validation)
