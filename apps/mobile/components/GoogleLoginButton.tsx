"use client";

import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

export default function GoogleLoginButton() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  const handleSuccess = async (credentialResponse: any) => {
    // Google bize şifrelenmiş güvenli bir 'credential' (JWT token) döner
    const idToken = credentialResponse.credential;
    
    console.log("Google'dan gelen Token:", idToken);

    // Şimdi bu token'ı doğrulaması için Node.js backend API'mize gönderiyoruz
    try {
      const response = await fetch('http://localhost:5000/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: idToken }),
      });

      const data = await response.json();
      if (response.ok) {
        console.log("Backend Giriş Başarılı! Bizim JWT:", data.myAppToken);
        // Burada gelen token'ı çerezlere (cookie) veya localStorage'a kaydedip kullanıcıyı içeri alabilirsin
      } else {
        console.error("Backend doğrulama hatası:", data.message);
      }
    } catch (error) {
      console.error("API isteği başarısız oldu:", error);
    }
  };

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => {
            console.log('Google ile giriş başarısız oldu');
          }}
          useOneTap // İsteğe bağlı: Sayfa açıldığında sağ üstte hızlı giriş penceresi açar
        />
      </div>
    </GoogleOAuthProvider>
  );
}
