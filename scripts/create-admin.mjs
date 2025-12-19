import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

async function createAdmin() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    const email = 'zzxxccvv1597533@gmail.com';
    const password = 'a123456789';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 檢查是否已存在
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    
    if (existing.length > 0) {
      // 更新現有用戶為管理員
      await connection.execute(
        `UPDATE users SET 
          password = ?,
          role = 'admin',
          activationStatus = 'activated',
          loginMethod = 'password'
        WHERE email = ?`,
        [hashedPassword, email]
      );
      console.log('✅ 管理員帳號已更新');
    } else {
      // 建立新管理員
      await connection.execute(
        `INSERT INTO users (email, password, name, role, activationStatus, loginMethod, createdAt, updatedAt, lastSignedIn)
         VALUES (?, ?, '管理員', 'admin', 'activated', 'password', NOW(), NOW(), NOW())`,
        [email, hashedPassword]
      );
      console.log('✅ 管理員帳號已建立');
    }
    
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 密碼: ${password}`);
    
  } catch (error) {
    console.error('❌ 錯誤:', error.message);
  } finally {
    await connection.end();
  }
}

createAdmin();
