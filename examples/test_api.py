import requests
import json
import os

def test_chart_generation():
    # Конфигурация для генерации графика
    config = {
        "network": "polygon_pos",
        "poolAddress": "0xa030be97a53d6462c675962fec3eafbe53b8bb6c",
        "duration": 24,
        "numBars": 20,
        "interval": "hour",
        "outputPath": "test_chart.png",  # Будет создан в текущей директории
        "customConfig": None
    }

    try:
        # Отправляем запрос к API
        response = requests.post(
            "http://localhost:8002/generate-chart",
            json=config
        )
        
        # Проверяем статус ответа
        if response.status_code == 200:
            result = response.json()
            print(f"Успех! График сохранен в: {result['file_path']}")
            print(f"Полный ответ API: {json.dumps(result, indent=2, ensure_ascii=False)}")
            
            # Проверяем, что файл действительно создан
            if os.path.exists(result['file_path']):
                print(f"Файл успешно создан, размер: {os.path.getsize(result['file_path'])} байт")
            else:
                print("Ошибка: файл не был создан")
        else:
            print(f"Ошибка: {response.status_code}")
            print(f"Текст ошибки: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("Ошибка подключения к API. Убедитесь, что сервер запущен на порту 8002")
    except Exception as e:
        print(f"Произошла ошибка: {str(e)}")

if __name__ == "__main__":
    test_chart_generation() 