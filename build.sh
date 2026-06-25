#!/bin/sh
cp index.html dist/index.html
sed -i "s|__FIREBASE_API_KEY__|${FIREBASE_API_KEY}|g" dist/index.html
sed -i "s|__FIREBASE_AUTH_DOMAIN__|${FIREBASE_AUTH_DOMAIN}|g" dist/index.html
sed -i "s|__FIREBASE_PROJECT_ID__|${FIREBASE_PROJECT_ID}|g" dist/index.html
sed -i "s|__FIREBASE_STORAGE_BUCKET__|${FIREBASE_STORAGE_BUCKET}|g" dist/index.html
sed -i "s|__FIREBASE_MESSAGING_SENDER_ID__|${FIREBASE_MESSAGING_SENDER_ID}|g" dist/index.html
sed -i "s|__FIREBASE_APP_ID__|${FIREBASE_APP_ID}|g" dist/index.html
sed -i "s|__CLOUDINARY_CLOUD_NAME__|${CLOUDINARY_CLOUD_NAME}|g" dist/index.html
sed -i "s|__CLOUDINARY_UPLOAD_PRESET__|${CLOUDINARY_UPLOAD_PRESET}|g" dist/index.html
cp manifest.json sw.js icon-*.png dist/
