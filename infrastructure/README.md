# infrastructure/

Bu klasor, projenin altyapi ile ilgili konfigurasyonlarini barindirmak icin ayrilmistir.

Su an icin asil altyapi tanimi (PostgreSQL) repo kokundeki [`docker-compose.yml`](../docker-compose.yml) dosyasinda yer aliyor.

Ileride buraya eklenebilecekler:

- Reverse proxy / nginx konfigurasyonlari
- Modbus TCP / SCADA gateway ayarlari
- On-premise deployment script'leri (systemd, vb.)
- Ek docker-compose servisleri (API, web, mesajlasma servisleri vb.)
