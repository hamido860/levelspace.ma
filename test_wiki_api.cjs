const axios = require('axios');

async function testWikiApi() {
  const query = "science";
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages|info&inprop=url&generator=search&gsrsearch=${query}&gsrlimit=10&pithumbsize=800`;

  try {
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'EduApp/1.0 (https://github.com/hamideduapp; hamid@example.com)'
        }
    });
    console.log(JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}

testWikiApi();
