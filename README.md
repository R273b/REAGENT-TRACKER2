# Reagent Log — دليل الإعداد من الصفر (نسخة جديدة كاملة)

## 1) Supabase (قاعدة بيانات جديدة)
1. روح https://supabase.com → أنشئ مشروع جديد (New project)
2. SQL Editor → New query → افتح ملف `supabase_schema.sql` من هذا المجلد → انسخ والصق الكل → Run
3. Project Settings → Data API → انسخ **API URL**
4. Project Settings → API Keys → انسخ **Publishable key**

## 2) ربط المشروع
انسخ `.env.example` وسمّه `.env`، وحط فيه القيمتين من فوق.

## 3) GitHub
1. github.com/new → اسم المستودع (مثلاً `reagent-tracker`) → Public → Create repository
2. "uploading an existing file" → ارفع **كل ملفات هذا المجلد** (بدون مجلدات فرعية، كلها بمستوى واحد):
   - App.jsx, Login.jsx, Settings.jsx, BarcodeScanner.jsx, ReceiveWizard.jsx
   - index.html, main.jsx, supabaseClient.js
   - package.json, vite.config.js, .env.example
3. Commit changes

## 4) Vercel
1. vercel.com → Add New → Project → استورد نفس الـ repository
2. Environment Variables:
   - `VITE_SUPABASE_URL` = رابط Supabase (بدون `/rest/v1/` بالآخر)
   - `VITE_SUPABASE_ANON_KEY` = الـ Publishable key
3. Deploy

## 5) أول دخول
- الفريق: `lab` / `lab`
- أنت (باسل): `basil` / `admin123` — **غيّره فورًا من صفحة Settings داخل الموقع بعد أول دخول**

## 6) قبل ما يستخدمه الفريق
روح Settings (بحساب الأدمن) وضيف قائمة أسماء الريجنت (Presets) — هذي القائمة اللي يختار منها الفريق عند الاستقبال.

## 7) دومين خاص (اختياري)
Vercel → Project → Settings → Domains → أضف الدومين اللي تملكه وحط سجلات DNS اللي يعطيك ياها.
