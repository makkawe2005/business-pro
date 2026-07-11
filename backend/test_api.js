const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const API = 'http://127.0.0.1:3001';
(async () => {
  try {
    console.log('GET /clients');
    let res = await fetch(`${API}/clients`);
    console.log('status', res.status);
    let clients = await res.json();
    console.log('clients count', clients.length);

    console.log('\nPOST /clients');
    res = await fetch(`${API}/clients`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name: 'TestCo', contact_name: 'Tester', email: 't@test.local'})
    });
    console.log('status', res.status);
    const created = await res.json();
    console.log('created id', created.id);

    console.log('\nGET /clients/:id');
    res = await fetch(`${API}/clients/${created.id}`);
    console.log('status', res.status);
    const detail = await res.json();
    console.log('detail.client.name', detail.client.name);

    console.log('\nPUT /clients/:id');
    res = await fetch(`${API}/clients/${created.id}`, {
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ phone: '+1-000-000', industry: 'Testing' })
    });
    console.log('status', res.status);

    console.log('\nPOST /clients/:id/notes');
    res = await fetch(`${API}/clients/${created.id}/notes`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ author_name: 'Tester', text: 'Automated test note' })
    });
    console.log('status', res.status);

    console.log('\nPOST /clients/:id/engagements');
    res = await fetch(`${API}/clients/${created.id}/engagements`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ title: 'Test engagement', description: 'From test' })
    });
    console.log('status', res.status);
    const eng = await res.json();
    console.log('eng id', eng.id);

    console.log('\nPOST /engagements/:id/assign');
    // assign to user id 1 (seed)
    res = await fetch(`${API}/engagements/${eng.id}/assign`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ to_user_id: 1, note: 'Assign from test' })
    });
    console.log('status', res.status);
    const assignRes = await res.json();
    console.log('assign event id', assignRes.event && assignRes.event.id);

    console.log('\nAPI tests completed successfully');
  } catch (err) {
    console.error('API test failed', err);
    process.exit(2);
  }
})();
