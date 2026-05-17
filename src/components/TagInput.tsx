import React, { useState, useEffect, useRef } from 'react';
import {
  TextField,
  Chip,
  Box,
  Typography,
  Autocomplete,
  Paper
} from '@mui/material';
import { styled } from '@mui/material/styles';

const TagsContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1),
  minHeight: '60px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(0.5),
  alignItems: 'flex-start',
  backgroundColor: theme.palette.background.default,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  '&:focus-within': {
    borderColor: theme.palette.primary.main,
  }
}));

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  availableTags?: string[];
  maxTags?: number;
  placeholder?: string;
  label?: string;
}

const TagInput: React.FC<TagInputProps> = ({
  tags = [],
  onChange,
  availableTags = [],
  maxTags = 10,
  placeholder = 'Add tags...',
  label = 'Tags'
}) => {
  const [inputValue, setInputValue] = useState('');
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string>('');
  const [autocompleteKey, setAutocompleteKey] = useState(0); // Ключ для принудительного перерендера
  const autocompleteRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Фильтруем доступные теги на основе ввода
  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = availableTags.filter(tag => 
        tag.toLowerCase().includes(inputValue.toLowerCase()) &&
        !tags.includes(tag.toLowerCase())
      );
      setFilteredTags(filtered.slice(0, 10)); // Показываем максимум 10 предложений
    } else {
      setFilteredTags([]);
    }
  }, [inputValue, availableTags, tags]);

  // Добавляем тег
  const addTag = (newTag: string) => {
    const cleanTag = newTag.trim().toLowerCase();
    setValidationError(''); // Сбрасываем ошибку валидации
    
    // Проверяем базовые условия
    if (!cleanTag) {
      // Принудительно очищаем поле и перерендериваем Autocomplete
      setInputValue('');
      setAutocompleteKey(prev => prev + 1);
      return;
    }
    
    if (tags.includes(cleanTag)) {
      setValidationError('Tag already exists');
      setInputValue('');
      setAutocompleteKey(prev => prev + 1);
      // Автоматически скрываем ошибку через 3 секунды
      setTimeout(() => setValidationError(''), 3000);
      return;
    }
    
    if (tags.length >= maxTags) {
      setValidationError(`Maximum ${maxTags} tags allowed`);
      setInputValue('');
      setAutocompleteKey(prev => prev + 1);
      setTimeout(() => setValidationError(''), 3000);
      return;
    }
    
    if (cleanTag.length > 30) {
      setValidationError('Tag cannot be longer than 30 characters');
      // НЕ очищаем поле ввода, чтобы пользователь мог укоротить тег
      setTimeout(() => setValidationError(''), 3000);
      return;
    }
    
    // Валидация тега - только латинские буквы, цифры, дефисы и подчеркивания
    const tagRegex = /^[a-zA-Z0-9\-_]+$/;
    if (!tagRegex.test(cleanTag)) {
      setValidationError('Tag can only contain latin letters, numbers, hyphens and underscores');
      // НЕ очищаем поле ввода, чтобы пользователь мог исправить тег
      setTimeout(() => setValidationError(''), 3000);
      return;
    }
    
    // Добавляем валидный тег
    onChange([...tags, cleanTag]);
    setInputValue('');
    setAutocompleteKey(prev => prev + 1); // Принудительно перерендериваем Autocomplete
    // Возвращаем фокус на поле ввода после добавления тега
    focusInput();
  };

  // Удаляем тег
  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
    // Возвращаем фокус на поле ввода после удаления тега
    focusInput();
  };

  // Обработка нажатия Enter, запятой или пробела
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
      event.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    }
  };

  // Обработка потери фокуса
  const handleBlur = () => {
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  };

  // Функция для возврата фокуса на поле ввода
  const focusInput = () => {
    // Небольшая задержка чтобы дать времени на перерендер
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  };

  return (
    <Box sx={{ mb: 2 }}>
      {label && (
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
          {label} ({tags.length}/{maxTags})
        </Typography>
      )}
      
      <TagsContainer elevation={0}>
        {/* Отображаем существующие теги */}
        {tags.map((tag, index) => (
          <Chip
            key={index}
            label={tag}
            onDelete={() => removeTag(tag)}
            size="small"
            color="primary"
            variant="outlined"
          />
        ))}
        
        {/* Поле ввода с автодополнением */}
        {tags.length < maxTags && (
          <Autocomplete
            key={autocompleteKey}
            ref={autocompleteRef}
            freeSolo
            options={filteredTags}
            inputValue={inputValue}
            onInputChange={(_, value) => setInputValue(value || '')}
            onChange={(_, value) => {
              if (value && typeof value === 'string') {
                addTag(value);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                inputRef={inputRef}
                variant="standard"
                placeholder={tags.length === 0 ? placeholder : ''}
                onKeyPress={handleKeyPress}
                onBlur={handleBlur}
                InputProps={{
                  ...params.InputProps,
                  disableUnderline: true,
                  sx: {
                    minWidth: '120px',
                    fontSize: '14px'
                  }
                }}
              />
            )}
            sx={{
              flexGrow: 1,
              minWidth: '120px',
              '& .MuiAutocomplete-input': {
                padding: '4px 0 !important'
              }
            }}
          />
        )}
      </TagsContainer>
      
      {tags.length >= maxTags && (
        <Typography variant="caption" color="warning.main" sx={{ mt: 0.5 }}>
          Maximum {maxTags} tags
        </Typography>
      )}
      
      {validationError && (
        <Typography variant="caption" color="error.main" sx={{ mt: 0.5, display: 'block' }}>
          {validationError}
        </Typography>
      )}
    </Box>
  );
};

export default TagInput; 