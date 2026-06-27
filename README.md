# 💳 مدير المصاريف الذكي

نظام تلقائي لتحليل كشف الحساب البنكي وتصنيف المصاريف بالذكاء الاصطناعي.

## المميزات
- 📄 رفع PDF كشف الحساب → AI يقرأ ويصنف تلقائياً
- 🏦 دعم حسابين بنكيين (شخصي + مشروع)
- 📊 لوحة تحكم مع رسوم بيانية
- 🤖 توصيات ذكاء اصطناعي شهرية
- 💾 تخزين دائم في Supabase

## الإعداد

### 1. Supabase
- المشروع جاهز: `dvdysiuxylvkxgwesogc`
- الجداول: bank_accounts, transactions, monthly_reports, pdf_uploads
- Edge Function: `parse-bank-statement` ← تحتاج Anthropic API Key

### 2. أضف Anthropic API Key في Supabase
1. افتح: https://supabase.com/dashboard/project/dvdysiuxylvkxgwesogc/settings/functions
2. أضف Secret: `ANTHROPIC_API_KEY` = مفتاحك من console.anthropic.com

### 3. Deploy على Vercel
```bash
npm install -g vercel
vercel --prod
```
أو:
1. ارفع المجلد على GitHub
2. اربطه بـ Vercel من vercel.com
3. Deploy تلقائي

### 4. اسم النطاق (Domain)
في Vercel Dashboard:
- Settings → Domains → Add Domain
- أضف النطاق الذي اشتريته
- اتبع تعليمات DNS

## البنية
```
expense-tracker/
├── app/
│   ├── layout.jsx    ← إعدادات الصفحة
│   └── page.jsx      ← التطبيق الكامل
├── package.json
├── next.config.mjs
└── vercel.json
```

## قاعدة البيانات (Supabase)
| الجدول | الوصف |
|--------|-------|
| bank_accounts | الحسابات البنكية |
| transactions | كل المعاملات |
| monthly_reports | التقارير الشهرية |
| pdf_uploads | سجل الملفات المرفوعة |
