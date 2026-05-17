import React, { useState, useEffect } from 'react';
import { 
  Button, Modal, Form, FormGroup, Label, Input, 
  ModalHeader, ModalBody, ModalFooter, Alert 
} from 'reactstrap';

/**
 * Компонент кнопки "Save to Gallery" с модальным окном
 * 
 * @param {Object} props
 * @param {string} props.imageBase64 - Base64 изображения для сохранения
 * @param {string} props.currentCategory - Текущая категория (body/center/topbot/bg)
 * @param {string} props.walletAddress - Адрес кошелька пользователя
 * @param {boolean} props.isSupreme - Является ли пользователь суперадмином
 * @param {string} props.imageOwner - Владелец изображения (если изображение из галереи)
 * @param {string} props.imageSource - Источник изображения ("gallery", "local", "url")
 * @param {Object} props.imageParams - Параметры изображения (scale, x_offset и т.д.)
 * @param {Function} props.onSuccess - Колбэк после успешного сохранения
 */
const SaveToGalleryButton = ({ 
  imageBase64, 
  currentCategory, 
  walletAddress, 
  isSupreme, 
  imageOwner,
  imageSource,
  imageParams = {},
  onSuccess
}) => {
  // Состояние модального окна
  const [modal, setModal] = useState(false);
  
  // Данные формы
  const [formData, setFormData] = useState({
    name: '',
    category: currentCategory || 'body',
    genre: ''
  });
  
  // Список жанров для выбранной категории
  const [genres, setGenres] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Определяем, активна ли кнопка
  const isButtonActive = () => {
    // Если кошелек не подключен, кнопка неактивна
    if (!walletAddress) return false;
    
    // Суперпользователь всегда может сохранять
    if (isSupreme) return true;
    
    // Если изображение загружено с компьютера, кнопка активна
    if (imageSource === 'local') return true;
    
    // Если изображение из галереи и принадлежит текущему пользователю, кнопка активна
    if (imageSource === 'gallery' && imageOwner === walletAddress) return true;
    
    // Во всех остальных случаях кнопка неактивна
    return false;
  };
  
  // Открыть/закрыть модальное окно
  const toggle = () => {
    setModal(!modal);
    if (!modal) {
      // При открытии окна сбрасываем сообщения об ошибках/успехе
      setError(null);
      setSuccess(null);
    }
  };
  
  // Загрузка списка жанров при открытии модального окна
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await fetch('/api/genres');
        const data = await response.json();
        
        if (data.success) {
          setGenres(data.genres);
        } else {
          console.error('Ошибка при загрузке жанров:', data.error);
        }
      } catch (error) {
        console.error('Ошибка при загрузке жанров:', error);
      }
    };
    
    if (modal) {
      fetchGenres();
    }
  }, [modal]);
  
  // Обработка изменения полей формы
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  // Сохранение изображения в галерею
  const handleSave = async () => {
    // Проверка заполнения обязательных полей
    if (!formData.name || !formData.category || !formData.genre) {
      setError('Пожалуйста, заполните все поля');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Подготавливаем данные для отправки
      const requestData = {
        name: formData.name,
        category: formData.category,
        genre: formData.genre,
        owner: walletAddress,
        imageBase64,
        // Добавляем параметры изображения
        ...imageParams
      };
      
      // Добавляем флаг force_overwrite для суперпользователя
      if (isSupreme) {
        requestData.force_overwrite = true;
      }
      
      // Отправляем запрос на сервер
      const response = await fetch('/api/save-to-gallery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.overwritten ? 'Изображение успешно обновлено!' : 'Изображение успешно сохранено!');
        
        // Через 1.5 секунды закрываем модальное окно
        setTimeout(() => {
          toggle();
          if (onSuccess) onSuccess(data);
        }, 1500);
      } else {
        setError(data.error || 'Ошибка при сохранении изображения');
      }
    } catch (error) {
      console.error('Ошибка при сохранении изображения:', error);
      setError('Ошибка при сохранении изображения');
    } finally {
      setLoading(false);
    }
  };
  
  // Если кнопка неактивна, возвращаем неактивную кнопку
  if (!isButtonActive()) {
    return (
      <Button color="secondary" disabled title="Подключите кошелек или выберите свое изображение">
        Save to Gallery
      </Button>
    );
  }
  
  return (
    <>
      <Button color="primary" onClick={toggle}>
        Save to Gallery
      </Button>
      
      <Modal isOpen={modal} toggle={toggle}>
        <ModalHeader toggle={toggle}>Сохранить в галерею</ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          {success && <Alert color="success">{success}</Alert>}
          
          <Form>
            <FormGroup>
              <Label for="name">Название</Label>
              <Input
                type="text"
                name="name"
                id="name"
                placeholder="Введите название изображения"
                value={formData.name}
                onChange={handleChange}
                disabled={loading}
              />
            </FormGroup>
            
            <FormGroup>
              <Label for="category">Категория</Label>
              <Input
                type="select"
                name="category"
                id="category"
                value={formData.category}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="body">Body</option>
                <option value="center">Center</option>
                <option value="topbot">TopBot</option>
                <option value="bg">Background</option>
              </Input>
            </FormGroup>
            
            <FormGroup>
              <Label for="genre">Жанр/Стиль</Label>
              <Input
                type="select"
                name="genre"
                id="genre"
                value={formData.genre}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="">Выберите жанр</option>
                {genres[formData.category]?.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </Input>
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </Button>
          <Button color="secondary" onClick={toggle} disabled={loading}>
            Отмена
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default SaveToGalleryButton; 