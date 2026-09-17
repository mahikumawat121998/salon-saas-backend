const axios = require('axios');
axios.post('http://localhost:3000/api/auth/login', { email: 'owner@urbancuts.com', password: 'Owner@123' }).then(res => { 
  const token = res.data.data.accessToken; 
  axios.get('http://localhost:3000/api/attendance?date=2026-09-16', { headers: { Authorization: `Bearer ${token}` } })
    .then(r => console.log(JSON.stringify(r.data, null, 2)))
    .catch(e => console.error(e.response?.data || e.message)); 
}).catch(e => console.error(e.response?.data || e.message));
