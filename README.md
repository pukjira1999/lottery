# วงล้อลุ้นเลข

เว็บจับรางวัลเลข 6 หลักแบบเรียลไทม์ มีหน้าสาธารณะสำหรับดูผลและค้นหาเลขด้วยชื่อ และหน้าผู้ดูแลที่ล็อกอินแล้วสำหรับนำเข้ารายชื่อและควบคุมการจับรางวัล ข้อมูลหลักเก็บใน PostgreSQL และ Socket.IO ส่งสถานะไปยังผู้ใช้ที่เชื่อมต่ออยู่

## เริ่มใช้งาน

ต้องใช้ Node.js 22.13 หรือใหม่กว่า และ PostgreSQL

สำหรับพัฒนาในเครื่อง มี PostgreSQL แยกของโปรเจกต์ผ่าน Docker Compose:

```bash
docker compose up -d db
DATABASE_URL=postgresql://lottery:lottery-local-dev@localhost:55432/lottery \
ADMIN_PASSWORD=admin \
SESSION_SECRET=local-dev-session-secret-change-me \
npm start
```

เปิด `http://localhost:3491` หรือ `http://localhost:3491/admin` รหัสผ่านแอดมินในชุดตั้งค่านี้คือ `admin` ค่าฐานข้อมูลนี้สำหรับพัฒนาในเครื่องเท่านั้น

กำหนดค่าต่อไปนี้ใน environment ก่อนเริ่ม:

- `DATABASE_URL` — connection string ของ PostgreSQL
- `ADMIN_PASSWORD` — รหัสผ่านผู้ดูแล (ค่าเริ่มต้น `admin`)
- `SESSION_SECRET` — secret แบบสุ่มและยาวสำหรับลงนาม session cookie
- `PORT` — พอร์ตเว็บ (ค่าเริ่มต้น `3491`)
- `DATA_DIR` — ที่อยู่ฐานข้อมูล SQLite เดิมที่ต้องการย้าย (ค่าเริ่มต้น `./data`)

```bash
npm install
npm start
```

เปิด `http://localhost:3491` สำหรับผู้ใช้ หรือ `http://localhost:3491/admin` สำหรับผู้ดูแล ระบบจะสร้าง schema ใน PostgreSQL และย้ายรายการกับประวัติจาก `data/lottery.sqlite` ให้อัตโนมัติเพียงครั้งเดียว หมายเลขเดิมที่มีเลข 0 จะถูกเก็บเป็น Invalid และรอบเก่าที่หมุนไม่ครบจะถูกปิดก่อนเริ่มรอบใหม่

## Deploy บนเซิร์ฟเวอร์โดยไม่ใช้ Docker

ติดตั้ง Node.js 22.13 หรือใหม่กว่าบนเซิร์ฟเวอร์ แล้วคัดลอกโปรเจกต์ไปไว้ที่นั่น จากโฟลเดอร์โปรเจกต์ติดตั้ง dependencies ด้วย `npm ci --omit=dev` และตั้ง environment ให้ process ของแอป:

- `NODE_ENV=production`
- `HOST=0.0.0.0` — รับการเชื่อมต่อจาก network interface ของเซิร์ฟเวอร์
- `DATABASE_URL` — connection string ของ PostgreSQL ที่เซิร์ฟเวอร์แอปเข้าถึงได้
- `ADMIN_PASSWORD` — รหัสผ่านใหม่ที่คาดเดายากสำหรับหน้า `/admin`
- `SESSION_SECRET` — ค่าสุ่มยาวสำหรับลงนาม session cookie
- `PORT=3491` — พอร์ตที่แอปรับการเชื่อมต่อ (เปลี่ยนได้)

จากนั้นเริ่มแอปด้วย `npm start` และใช้ systemd หรือ process manager เพื่อให้แอปเริ่มใหม่เมื่อเซิร์ฟเวอร์รีสตาร์ต หากเก็บค่าไว้ใน `.env` ต้องสั่งให้ process โหลดไฟล์นั้น เพราะแอปไม่ได้โหลด `.env` เอง

เปิดพอร์ต TCP ที่กำหนดไว้ใน firewall ของเซิร์ฟเวอร์และผู้ให้บริการเครือข่าย แล้วผู้ใช้เข้าได้ที่ `http://<server-ip>:3491` ไม่ต้องใส่ IP จริงของเครื่องในโค้ด: ใช้ private IP สำหรับอุปกรณ์ในเครือข่ายเดียวกัน และ public IP สำหรับผู้ใช้จากอินเทอร์เน็ต หากเซิร์ฟเวอร์อยู่หลัง router ให้ตั้ง port forwarding ด้วย ใช้ HTTPS ผ่าน reverse proxy เมื่อต้องการใช้งานจริงบนอินเทอร์เน็ต ตัวแอปจะสร้าง schema ใน PostgreSQL เมื่อเริ่มทำงาน; ไม่ควรเปิดพอร์ต PostgreSQL ให้คนทั่วไป และห้าม commit ค่าลับลง repository เมื่อ `NODE_ENV=production` แอปจะไม่เริ่มทำงานหากไม่ได้ตั้ง `ADMIN_PASSWORD` และ `SESSION_SECRET`

## นำเข้า Excel

ผู้ดูแลเข้าสู่ระบบที่ `/admin` แล้วเลือกไฟล์ `.xls` หรือ `.xlsx` (ชีตแรก) ซึ่งมีหัวคอลัมน์ชื่อ เช่น `ชื่อ` หรือ `name` และเลข เช่น `เลขสลาก` หรือ `number` ระบบแสดงตัวอย่าง Valid/Invalid และเตือนเลขซ้ำก่อนให้ยืนยันนำเข้า แถว Invalid จะยังค้นหาเจอแต่ไม่เข้าร่วมคำนวณผู้ชนะ เลขที่เป็นตัวเลขใน Excel จะเติมศูนย์ด้านหน้าให้ครบหกหลักก่อนตรวจรูปแบบ `[1-9]{6}`

## API

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session` — session ผู้ดูแล
- `GET /api/state` — สถานะรอบและประวัติสาธารณะ (ไม่มีรายชื่อรวม)
- `GET /api/search?name=...` — ค้นหาชื่อบางส่วน โดยไม่แยกตัวพิมพ์เล็ก/ใหญ่
- `GET /api/admin/state` — สถานะและรายการทั้งหมด (ต้องล็อกอิน)
- `POST /api/import/preview` — preview ไฟล์ Excel (multipart field `file`, ต้องล็อกอิน)
- `POST /api/import/confirm` — ยืนยันด้วย `previewId`, `mode` (`append` หรือ `replace`) และการรับทราบเลขซ้ำ (ต้องล็อกอิน)
- `POST /api/admin/draw/spin` (JSON `commandId` UUID เพื่อกันคำสั่งซ้ำ), `POST /api/admin/draw/new` — ควบคุมรอบ (ต้องล็อกอิน)
- `GET /api/draw/history` — ประวัติผล
- Socket.IO — `lottery:snapshot`, `lottery:draw-started`, `lottery:spinning`, `lottery:number-revealed`, `lottery:draw-completed`, `lottery:winner-announced`, `lottery:imported`, `lottery:reset`; admin socket ที่ล็อกอินจะได้รับ `admin:snapshot`
# lottery
