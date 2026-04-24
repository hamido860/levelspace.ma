const axios = require('axios');

async function testWikiApi() {
  const query = "science";
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&generator=search&gsrsearch=${query}&gsrlimit=6&pithumbsize=800`;

  try {
    const response = await axios.get(url);
    console.log(JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

testWikiApi();
