import axios from 'axios';

// Determine if we're in production environment
const isProduction = window.location.hostname === 'tchart.xyz' || 
                    window.location.hostname.includes('tchart.xyz');

// Base API URL depending on environment
export const BASE_URL = isProduction 
  ? 'https://tchart.xyz/api' 
  : 'http://localhost:3002/api';

// Base URL for images
export const IMAGE_BASE_URL = isProduction
  ? 'https://tchart.xyz' 
  : 'http://localhost:3002';

// Interface for image file
interface ImageFile {
  filename: string;
  path: string;
  id?: number;
  name?: string;
  genre?: string;
  class?: string;
  owner?: string; // Owner's wallet address
  scale?: number;
  x_offset?: number;
  y_offset?: number;
  rotation?: number;
  overlap?: number;
  color?: string;
  mirrored?: boolean;
  has_params?: boolean;
  tags?: string[]; // Add tags support
}

// Server response interface (actual format)
interface ServerResponse {
  images: {
    [categoryName: string]: ImageFile[];
  };
}

// Our internal format for working with categories
interface ImageCategory {
  name: string;
  images: ImageFile[]; // Changed from string[] to ImageFile[]
}

// Transformed response interface for use in components
interface ImagesResponse {
  categories: ImageCategory[];
}

/**
 * Fetches images from specified category on the server
 * @param category - 'body', 'center', 'topbot' or 'bg'
 * @param tags - optional array of tags for filtering
 * @returns Promise with response containing categories and images
 */
export const fetchImages = async (
  category: 'body' | 'center' | 'topbot' | 'bg',
  tags?: string[]
): Promise<ImagesResponse> => {
  try {
    const params: any = {};
    if (tags && tags.length > 0) {
      // Сервер поддерживает Array.isArray(tags), отправляем массив
      params.tags = tags;
    }
    
    const response = await axios.get<ServerResponse>(`${BASE_URL}/images/${category}`, { params });
    // console.log(`Data received for category ${category}:`, response.data);
    
    // Transform server response format to our required format
    const formattedResponse: ImagesResponse = {
      categories: []
    };
    
    // If images object exists in the response
    if (response.data && response.data.images) {
      // Transform categories object to categories array
      Object.entries(response.data.images).forEach(([categoryName, imageFiles]) => {
        if (imageFiles && imageFiles.length > 0) {
        formattedResponse.categories.push({
            name: categoryName || 'Default',
            images: imageFiles // Now we pass the full image objects
          });
        }
      });
    }
    
    // Если после обработки категорий нет, добавим пустую категорию по умолчанию
    // чтобы интерфейс мог корректно отобразить отсутствие изображений
    if (formattedResponse.categories.length === 0) {
      formattedResponse.categories.push({
        name: 'Default',
        images: []
      });
    }
    
    console.log('Transformed response:', formattedResponse);
    return formattedResponse;
  } catch (error) {
    console.error(`Error loading images for category ${category}:`, error);
    // Return default category even in case of error
    return { 
      categories: [{ 
        name: 'Default', 
        images: [] 
      }] 
    };
  }
};

/**
 * Fetches all images from all categories on the server
 * @param category - 'body', 'center', 'topbot' or 'bg' (used for server endpoint)
 * @param tags - optional array of tags for filtering
 * @returns Promise with response containing categories and images from all genres
 */
export const fetchAllImages = async (
  category: 'body' | 'center' | 'topbot' | 'bg',
  tags?: string[]
): Promise<ImagesResponse> => {
  try {
    const params: any = {};
    // ВРЕМЕННО отключаем серверную фильтрацию по тегам
    // if (tags && tags.length > 0) {
    //   params.tags = tags;
    //   console.log(`[API] fetchAllImages - Sending tags as array:`, tags);
    // }
    
    if (tags && tags.length > 0) {
      console.log(`[API] fetchAllImages - Will filter client-side by tags:`, tags);
    }
    
    console.log(`[API] fetchAllImages - Making request to: ${BASE_URL}/images/${category}`, { params });
    
    const response = await axios.get<ServerResponse>(`${BASE_URL}/images/${category}`, { params });
    console.log(`[API] fetchAllImages - Data received for category ${category} (all images):`, response.data);
    
    // Transform server response format to our required format
    const formattedResponse: ImagesResponse = {
      categories: []
    };
    
    // Collect all images from all categories into one
    const allImages: ImageFile[] = [];
    
    // If images object exists in the response
    if (response.data && response.data.images) {
      // Add categories based on genres from database
      Object.entries(response.data.images).forEach(([categoryName, imageFiles]) => {
        if (imageFiles && imageFiles.length > 0) {
          formattedResponse.categories.push({
            name: categoryName || 'Default',
            images: imageFiles
          });
          
          // Add all images to the combined collection
          allImages.push(...imageFiles);
        }
      });
      
      // Add ALL category at the end with all images
      if (allImages.length > 0) {
        formattedResponse.categories.push({
          name: 'ALL',
          images: allImages
        });
      }
    }
    
    // Если после обработки категорий нет, добавим пустую категорию по умолчанию
    if (formattedResponse.categories.length === 0) {
      formattedResponse.categories.push({
        name: 'Default',
        images: []
      });
    }
    
    console.log('Transformed response with genre-based categories and ALL:', formattedResponse);
    
    // Клиентская фильтрация по тегам
    if (tags && tags.length > 0) {
      console.log(`[API] Applying client-side filtering by tags:`, tags);
      
      const filteredResponse: ImagesResponse = {
        categories: []
      };
      
      formattedResponse.categories.forEach(category => {
                 const filteredImages = category.images.filter(image => {
           // Если у изображения есть теги, проверяем пересечение
           if (image.tags && Array.isArray(image.tags) && image.tags.length > 0) {
             return tags.some(tag => 
               image.tags!.some(imageTag => 
                 imageTag.toLowerCase().includes(tag.toLowerCase())
               )
             );
           }
           return false;
         });
        
        if (filteredImages.length > 0) {
          filteredResponse.categories.push({
            name: category.name,
            images: filteredImages
          });
        }
      });
      
      console.log(`[API] After filtering: ${filteredResponse.categories.length} categories with images`);
      
      // Логирование результатов фильтрации
      filteredResponse.categories.forEach((category, index) => {
        console.log(`[API] Filtered Category ${index}: "${category.name}" has ${category.images.length} images`);
        if (category.images.length > 0) {
          console.log(`[API] First few filtered images in "${category.name}":`, category.images.slice(0, 3).map(img => ({
            name: img.name || img.filename,
            tags: img.tags || [],
            path: img.path
          })));
        }
      });
      
      return filteredResponse;
    }
    
    // Подробное логирование категорий и изображений (без фильтрации)
    formattedResponse.categories.forEach((category, index) => {
      console.log(`[API] Category ${index}: "${category.name}" has ${category.images.length} images`);
      if (category.images.length > 0) {
        console.log(`[API] First few images in "${category.name}":`, category.images.slice(0, 3).map(img => ({
          name: img.name || img.filename,
          tags: img.tags || [],
          path: img.path
        })));
      }
    });
    
    return formattedResponse;
  } catch (error) {
    console.error(`Error loading all images for category ${category}:`, error);
    // Return default category even in case of error
    return { 
      categories: [{ 
        name: 'Default', 
        images: [] 
      }] 
    };
  }
};

/**
 * Creates URL for an image
 * @param path - relative path to the image
 * @returns full image URL
 */
export const getImageUrl = (path: string): string => {
  // The API returns paths like /pic/topbot/zipper.png
  // No need to add an additional /pic/ in the URL
  return `${IMAGE_BASE_URL}${path}`;
};

/**
 * Fetches available tags for images
 * @returns Promise with array of available tags
 */
export const fetchAvailableTags = async (): Promise<string[]> => {
  try {
    // Попробуем получить теги только из изображений, а не из пресетов
    console.log(`[API] fetchAvailableTags - Making request to: ${BASE_URL}/tags?type=images`);
    const response = await axios.get(`${BASE_URL}/tags?type=images`);
    console.log('[API] fetchAvailableTags - Response:', response.data);
    
    if (response.data && response.data.success) {
      console.log('[API] fetchAvailableTags - Available tags from server (images only):', response.data.tags);
      console.log('[API] fetchAvailableTags - Count:', response.data.count);
      
      // Если тегов из изображений нет, попробуем получить все теги
      if (response.data.tags.length === 0) {
        console.log('[API] fetchAvailableTags - No image tags found, trying all tags...');
        const allTagsResponse = await axios.get(`${BASE_URL}/tags`);
        console.log('[API] fetchAvailableTags - All tags response:', allTagsResponse.data);
        
        if (allTagsResponse.data && allTagsResponse.data.success) {
          return allTagsResponse.data.tags;
        }
      }
      
      return response.data.tags;
    }
    
    return [];
  } catch (error) {
    console.error('Error loading available tags:', error);
    return [];
  }
}; 