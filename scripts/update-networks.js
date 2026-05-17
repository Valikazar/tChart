const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function updateNetworks() {
  try {
    console.log('Fetching networks data from GeckoTerminal API...');
    const response = await axios.get('https://api.geckoterminal.com/api/v2/networks');
    
    if (response.data && response.data.data) {
      // Создаем директорию src/data если она не существует
      const dataDir = path.join(__dirname, '../src/data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Записываем данные в файл
      const filePath = path.join(dataDir, 'networks.json');
      fs.writeFileSync(filePath, JSON.stringify(response.data, null, 2));
      console.log('Networks data successfully updated!');
    } else {
      throw new Error('Invalid response format from API');
    }
  } catch (error) {
    console.error('Error updating networks data:', error.message);
    process.exit(1);
  }
}

updateNetworks(); 