import React, { useState, useEffect } from 'react';
import { IconButton, Tooltip, Badge } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import axios from 'axios';

interface PresetLikeButtonProps {
  presetId: number;
  initialLikes: number;
  userAddress?: string;
  initialLiked?: boolean;
  onLikeChange?: (presetId: number, liked: boolean, newLikesCount: number) => void;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

const PresetLikeButton: React.FC<PresetLikeButtonProps> = ({
  presetId,
  initialLikes,
  userAddress,
  initialLiked = false,
  onLikeChange,
  size = 'medium',
  disabled = false
}) => {
  const [liked, setLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [loading, setLoading] = useState(false);

  // Update state when props change
  useEffect(() => {
    setLiked(initialLiked);
    setLikesCount(initialLikes);
  }, [initialLiked, initialLikes]);

  const handleLikeToggle = async () => {
    if (!userAddress || loading || disabled) return;

    setLoading(true);
    
    try {
      const baseUrl = process.env.NODE_ENV === 'production'
        ? window.location.origin
        : 'http://localhost:3002';

      const response = await axios.post(`${baseUrl}/api/presets-toggle-like`, {
        preset_id: presetId,
        user_address: userAddress
      });

      if (response.data.success) {
        const newLiked = response.data.liked;
        const newLikesCount = response.data.likes;
        
        setLiked(newLiked);
        setLikesCount(newLikesCount);
        
        if (onLikeChange) {
          onLikeChange(presetId, newLiked, newLikesCount);
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Don't update state on error
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    handleLikeToggle();
  };

  return (
    <Tooltip title={liked ? 'Remove like' : 'Add like'}>
      <IconButton
        onClick={handleClick}
        disabled={disabled || loading || !userAddress}
        size={size}
        sx={{
          color: liked ? '#e91e63' : 'inherit',
          '&:hover': {
            color: liked ? '#c2185b' : '#e91e63'
          }
        }}
      >
        <Badge badgeContent={likesCount} color="primary" max={999}>
          {liked ? <FavoriteIcon /> : <FavoriteBorderIcon />}
        </Badge>
      </IconButton>
    </Tooltip>
  );
};

export default PresetLikeButton; 