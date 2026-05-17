import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Alert, Box, Card, CardMedia, CardContent, CardActions, Divider, FormControlLabel, Checkbox, Tabs, Tab } from '@mui/material';
import axios from 'axios';
import PresetLikeButton from './PresetLikeButton';

const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3002';
const SUPREME_ADMIN = '0xf7427BD018809723e778Be7EaE4FaB6C81474C70';

// Axios instance configuration
const axiosInstance = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 10000
});

// Component for displaying tab content
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
  address: string | undefined;
  onPresetSelect?: (presetConfig: any) => void;
  onEditPreset?: (presetName: string, presetId: number) => void;
}

const ProfileDialog: React.FC<ProfileDialogProps> = ({ open, onClose, address, onPresetSelect, onEditPreset }) => {
  const [username, setUsername] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [presets, setPresets] = useState<any[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [includeNotPublished, setIncludeNotPublished] = useState(false);
  const [onlyMy, setOnlyMy] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [includeNotPublishedImages, setIncludeNotPublishedImages] = useState(false);
  const [onlyMyImages, setOnlyMyImages] = useState(false);
  const [imageRefreshKey, setImageRefreshKey] = useState(Date.now());
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [likedPresets, setLikedPresets] = useState<any[]>([]);
  const [likedPresetsLoading, setLikedPresetsLoading] = useState(false);

  const isAdmin = address?.toLowerCase() === SUPREME_ADMIN.toLowerCase();

  // Tab change handler
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Function to load presets
  const loadPresets = async () => {
    if (!address) return;
    
    setPresetsLoading(true);
    try {
      let url = '/api/presets';
      const params = new URLSearchParams();
      
      if (isAdmin) {
        // For superadmin
        if (onlyMy) {
          // Only own presets
          params.append('owner', address);
        } else {
          // All presets or only public ones
          if (!includeNotPublished) {
            // Only public (public = true)
            params.append('public', 'true');
          }
          // If includeNotPublished = true, load all presets without filter
        }
      } else {
        // For regular user - only own presets
        params.append('owner', address);
      }
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      const response = await axiosInstance.get(url);
      const presetsData = response.data.presets || [];
      setPresets(presetsData);
    } catch (err) {
      console.error('Error loading presets:', err);
    } finally {
      setPresetsLoading(false);
    }
  };

  // Function to load images
  const loadImages = async () => {
    if (!address) return;
    
    setImagesLoading(true);
    try {
      let url;
      const params = new URLSearchParams();
      
      if (isAdmin) {
        // For superadmin
        if (onlyMyImages) {
          // Only own images
          url = '/api/user-images';
          params.append('owner', address);
        } else {
          // All images
          url = '/api/all-images';
          if (!includeNotPublishedImages) {
            // Only published (approved = true)
            params.append('approved', 'true');
          }
        }
      } else {
        // For regular user - only own images
        url = '/api/user-images';
        params.append('owner', address);
      }
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      const response = await axiosInstance.get(url);
      const imagesData = response.data.images || [];
      setImages(imagesData);
    } catch (err) {
      console.error('Error loading images:', err);
    } finally {
      setImagesLoading(false);
    }
  };

  // Function to load users (admin only)
  const loadUsers = async () => {
    if (!address || !isAdmin) return;
    
    setUsersLoading(true);
    try {
      const response = await axiosInstance.get('/api/users');
      const usersData = response.data.users || [];
      setUsers(usersData);
    } catch (err) {
      console.error('Error loading users:', err);
      // Fallback: try to load from usernames.json
      try {
        const usernamesResponse = await axios.get(`${API_BASE}/api/usernames.json`);
        const usernames = usernamesResponse.data;
        const fallbackUsers = Object.entries(usernames).map(([address, username]) => ({
          address,
          username,
          presets_count: 0,
          images_count: 0,
          created_at: null
        }));
        setUsers(fallbackUsers);
      } catch (fallbackErr) {
        console.error('Error loading fallback users data:', fallbackErr);
      }
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (open && address) {
      // Get current user username
      axios.get(`${API_BASE}/api/usernames.json`)
        .then(res => {
          setCurrentUsername(res.data[address] || '');
          setUsername(res.data[address] || '');
        })
        .catch(() => setCurrentUsername(''));
      
      // Load user presets
      loadPresets();
      
      // Load user images
      loadImages();
      
      // Load liked presets
      loadLikedPresets();
      
      // Load users list (admin only)
      if (isAdmin) {
        loadUsers();
      }
    }
  }, [open, address, includeNotPublished, onlyMy, includeNotPublishedImages, onlyMyImages, isAdmin]);

  // Function to load liked presets
  const loadLikedPresets = async () => {
    if (!address) return;
    
    setLikedPresetsLoading(true);
    try {
      const response = await axiosInstance.get(`/api/user-liked-presets/${address}`);
      if (response.data.success) {
        setLikedPresets(response.data.presets || []);
      }
    } catch (error) {
      console.error('Error loading liked presets:', error);
    } finally {
      setLikedPresetsLoading(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_BASE}/api/generate-nickname`);
      setUsername(res.data.nickname);
    } catch {
      setError('Failed to generate nickname');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_BASE}/api/user-set-username`, { address, username });
      setCurrentUsername(res.data.username);
      setError('');
      onClose();
    } catch (e: any) {
      if (e.response?.status === 409) setError('Username already taken');
      else setError('Failed to save username');
    }
    setLoading(false);
  };

  const handleApprove = async (id: number) => {
    try {
      await axiosInstance.post('/api/presets-approve', { id, admin: address });
      // Reload presets list and update image key
      setImageRefreshKey(Date.now());
      loadPresets();
    } catch (e) {
      console.error('Error approving preset:', e);
    }
  };

  const handleUnapprove = async (id: number) => {
    try {
      await axiosInstance.post('/api/presets-unapprove', { id, admin: address });
      // Reload presets list and update image key
      setImageRefreshKey(Date.now());
      loadPresets();
    } catch (e) {
      console.error('Error unapproving preset:', e);
    }
  };

  const handleMakePublic = async (id: number) => {
    try {
      const response = await axiosInstance.post('/api/presets-toggle-public', { id, owner: address });
      if (response.data.success) {
        // Reload presets list and update image key
        setImageRefreshKey(Date.now());
        loadPresets();
      }
    } catch (e: any) {
      console.error('Error making preset public:', e);
    }
  };

  const handleDeletePreset = async (id: number) => {
    const preset = presets.find(p => p.id === id);
    const isOwner = preset?.owner === address;
    
    let confirmMessage = 'Are you sure you want to delete this preset? This action cannot be undone.';
    if (isAdmin && !isOwner) {
      confirmMessage = `WARNING! You are deleting another user's preset (${preset?.owner}).\n\nAre you sure you want to delete this preset? This action cannot be undone.`;
    }
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await axiosInstance.post('/api/presets-delete', { id, owner: address });
      if (response.data.success) {
        // Reload presets list and update image key
        setImageRefreshKey(Date.now());
        loadPresets();
      }
    } catch (e: any) {
      console.error('Error deleting preset:', e);
    }
  };

  const handleApproveImage = async (id: number) => {
    try {
      await axiosInstance.post('/api/images-approve', { id, admin: address });
      // Reload images list
      loadImages();
    } catch (e) {
      console.error('Error approving image:', e);
    }
  };

  const handleDeleteImage = async (id: number) => {
    const image = images.find(img => img.id === id);
    const isOwner = image?.owner === address;
    
    let confirmMessage = 'Are you sure you want to delete this image? This action cannot be undone.';
    if (isAdmin && !isOwner) {
      confirmMessage = `WARNING! You are deleting another user's image (${image?.owner}).\n\nAre you sure you want to delete this image? This action cannot be undone.`;
    }
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await axiosInstance.post('/api/images-delete', { id, owner: address });
      if (response.data.success) {
        // Reload images list
        loadImages();
      }
    } catch (e: any) {
      console.error('Error deleting image:', e);
    }
  };

  const handleLoadPreset = async (presetName: string, presetId: number) => {
    if (!onPresetSelect) {
      console.error('onPresetSelect is not provided');
      return;
    }
    
    try {
      console.log(`Loading preset: ${presetName}`);
      const response = await axiosInstance.get(`/api/preset/${presetName}`);
      console.log('Preset response:', response.data);
      
      if (response.data && response.data.config) {
        console.log('Applying preset configuration...');
        onPresetSelect(response.data.config);
        console.log('Preset applied successfully');
        
        // Activate edit mode if onEditPreset is provided
        if (onEditPreset) {
          onEditPreset(presetName, presetId);
          console.log('Edit mode activated for preset:', presetName);
        }
        
        onClose(); // Close dialog after applying
      } else {
        console.error('No config data received from preset API');
      }
    } catch (error) {
      console.error('Error loading preset:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
        console.error('Error status:', error.response.status);
      }
    }
  };

  // Function to handle like changes
  const handleLikeChange = (presetId: number, liked: boolean, newLikesCount: number) => {
    if (!liked) {
      // Remove preset from liked list if unliked
      setLikedPresets(prev => prev.filter(preset => preset.id !== presetId));
    }
    
    // Update likes count in the list
    setLikedPresets(prev => prev.map(preset => {
      if (preset.id === presetId) {
        return {
          ...preset,
          user_liked: liked,
          likes: newLikesCount
        };
      }
      return preset;
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth disableAutoFocus disableEnforceFocus sx={{ zIndex: 1500 }}>
      <DialogTitle>Profile</DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ width: '100%' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            centered
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Profile" />
            <Tab label="Your Presets" />
            <Tab label="Liked Presets" />
            <Tab label="Your Images" />
            {isAdmin && <Tab label="Users" />}
          </Tabs>
          
          {/* Profile Tab */}
          <TabPanel value={tabValue} index={0}>
            <Typography variant="subtitle1" gutterBottom>
              Wallet address: {address}
            </Typography>
            <Typography variant="subtitle2" gutterBottom>
              Current username: <b>{currentUsername || 'Not set'}</b>
            </Typography>
            <TextField
              label="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              fullWidth
              margin="normal"
              disabled={loading}
            />
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Button onClick={handleGenerate} disabled={loading}>
                Generate random
              </Button>
              <Button 
                onClick={handleSave} 
                variant="contained" 
                disabled={loading || !username || !address}
              >
                Save Username
              </Button>
            </Box>
            {!address && <Alert severity="warning" sx={{ mb: 2 }}>Connect your wallet to set a username.</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
          </TabPanel>

          {/* Your Presets Tab */}
          <TabPanel value={tabValue} index={1}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {isAdmin ? 'Presets Management' : 'Your Presets'}
            </Typography>
            
            {/* Information for regular users */}
            {!isAdmin && (
                          <Typography variant="body2" sx={{ mb: 2, p: 2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 1 }}>
              **LOAD** - load preset to current configuration and activate edit mode<br/>
              **PUBLISH** - publish preset for everyone (only for your presets)<br/>
              **DELETE** - delete unpublished preset (only for your presets)<br/>
              To create and edit presets use **SAVE PRESET** button
            </Typography>
            )}
            
            {/* Information for superadmin */}
            {isAdmin && (
              <Typography variant="body2" sx={{ mb: 2, p: 2, bgcolor: 'rgba(255, 193, 7, 0.1)', borderRadius: 1 }}>
                **Admin Mode**: You can manage all presets<br/>
                **Approve** - approve preset for public access<br/>
                **Unapprove** - remove approval from preset
              </Typography>
            )}
            
            {/* Filters for superadmin */}
            {isAdmin && (
              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeNotPublished}
                      onChange={(e) => setIncludeNotPublished(e.target.checked)}
                    />
                  }
                  label="Include not published"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={onlyMy}
                      onChange={(e) => setOnlyMy(e.target.checked)}
                    />
                  }
                  label="Only my"
                />
              </Box>
            )}
            
            {presetsLoading ? (
              <Typography>Loading presets...</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {presets.length > 0 ? (
                  presets.map((preset: any) => (
                    <Box key={preset.id} sx={{ width: { xs: '100%', sm: '45%', md: '30%', lg: '23%' } }}>
                      <Card>
                        <CardMedia
                          component="img"
                          height="120"
                          image={`${API_BASE}/api/preset-image/${preset.name}?t=${imageRefreshKey}`}
                          alt={preset.name}
                        />
                        <CardContent>
                          <Typography variant="subtitle1">{preset.name}</Typography>
                          <Typography variant="body2">Genre: {preset.genre}</Typography>
                          <Typography variant="body2">Owner: {preset.owner}</Typography>
                          <Typography variant="body2">Likes: {preset.likes}</Typography>
                          <Typography variant="body2">Uses: {preset.uses}</Typography>
                          <Typography variant="body2">Approved: {preset.approved ? 'Yes' : 'No'}</Typography>
                          <Typography variant="body2">Public: {preset.public ? 'Yes' : 'No'}</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                            Created: {new Date(preset.created_at).toLocaleDateString()}
                          </Typography>
                        </CardContent>
                        <CardActions sx={{ flexWrap: 'wrap', gap: 1 }}>
                          {/* Apply button for approved presets */}
                          {(preset.approved || preset.owner === address) && (
                            <Button 
                              size="small" 
                              color="primary" 
                              onClick={() => handleLoadPreset(preset.name, preset.id)}
                              variant="contained"
                              sx={{ mb: 1 }}
                            >
                              LOAD
                            </Button>
                          )}
                          
                          {/* Management buttons for superadmin */}
                          {isAdmin && (
                            <>
                              {/* Approve button only for admin and non-approved presets */}
                              {!preset.approved && (
                                <Button size="small" color="success" onClick={() => handleApprove(preset.id)}>
                                  Approve
                                </Button>
                              )}
                              {/* Unapprove button only for admin and approved presets */}
                              {preset.approved && (
                                <Button size="small" color="warning" onClick={() => handleUnapprove(preset.id)}>
                                  Unapprove
                                </Button>
                              )}
                            </>
                          )}
                          
                          {/* PUBLISH button for preset owner (only for non-public presets) */}
                          {preset.owner === address && !preset.public && (
                            <Button 
                              size="small"
                              color="error"
                              onClick={() => handleMakePublic(preset.id)}
                              sx={{ border: '1px solid #d32f2f' }}
                            >
                              PUBLISH
                            </Button>
                          )}
                          
                          {/* Delete button for owner of unpublished presets or for admin */}
                          {((preset.owner === address && !preset.approved && !preset.public) || isAdmin) && (
                            <Button 
                              size="small"
                              color="warning"
                              onClick={() => handleDeletePreset(preset.id)}
                              sx={{ border: '1px solid #ed6c02' }}
                            >
                              DELETE
                            </Button>
                          )}
                        </CardActions>
                      </Card>
                    </Box>
                  ))
                ) : (
                  <Typography>No presets found</Typography>
                )}
              </Box>
            )}
          </TabPanel>

          {/* Liked Presets Tab */}
          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Liked Presets
            </Typography>
            
            <Typography variant="body2" sx={{ mb: 2, p: 2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 1 }}>
              **LOAD** - load preset to current configuration and activate edit mode<br/>
              **LIKE** - remove like from preset (heart button)
            </Typography>
            
            {likedPresetsLoading ? (
              <Typography>Loading liked presets...</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {likedPresets.length > 0 ? (
                  likedPresets.map((preset: any) => (
                    <Box key={preset.id} sx={{ width: { xs: '100%', sm: '45%', md: '30%', lg: '23%' } }}>
                      <Card sx={{ position: 'relative' }}>
                        <CardMedia
                          component="img"
                          height="120"
                          image={`${API_BASE}/api/preset-image/${preset.name}?t=${imageRefreshKey}`}
                          alt={preset.name}
                        />
                        <CardContent>
                          <Typography variant="subtitle1">{preset.name}</Typography>
                          <Typography variant="body2">Genre: {preset.genre}</Typography>
                          <Typography variant="body2">Owner: {preset.owner}</Typography>
                          <Typography variant="body2">Likes: {preset.likes}</Typography>
                          <Typography variant="body2">Uses: {preset.uses}</Typography>
                          <Typography variant="body2">Approved: {preset.approved ? 'Yes' : 'No'}</Typography>
                          <Typography variant="body2">Public: {preset.public ? 'Yes' : 'No'}</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                            Created: {new Date(preset.created_at).toLocaleDateString()}
                          </Typography>
                        </CardContent>
                        <CardActions sx={{ flexWrap: 'wrap', gap: 1 }}>
                          {/* Apply button for approved presets */}
                          {(preset.approved || preset.owner === address) && (
                            <Button 
                              size="small" 
                              color="primary" 
                              onClick={() => handleLoadPreset(preset.name, preset.id)}
                            >
                              LOAD
                            </Button>
                          )}
                        </CardActions>
                        
                        {/* Like button */}
                        <Box sx={{ 
                          position: 'absolute', 
                          top: 8, 
                          right: 8, 
                          zIndex: 1,
                          backgroundColor: 'rgba(0, 0, 0, 0.5)',
                          borderRadius: '50%'
                        }}>
                          <PresetLikeButton
                            presetId={preset.id}
                            initialLikes={preset.likes}
                            userAddress={address}
                            initialLiked={preset.user_liked}
                            onLikeChange={handleLikeChange}
                            size="small"
                          />
                        </Box>
                      </Card>
                    </Box>
                  ))
                ) : (
                  <Typography>No liked presets found</Typography>
                )}
              </Box>
            )}
          </TabPanel>

          {/* Your Images Tab */}
          <TabPanel value={tabValue} index={3}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {isAdmin ? 'Images Management' : 'Your Images'}
            </Typography>
            
            {/* Information for regular users */}
            {!isAdmin && (
              <Typography variant="body2" sx={{ mb: 2, p: 2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 1 }}>
                **DELETE** - delete unpublished image (only for your images)<br/>
                To upload new images use corresponding sections in configurator
              </Typography>
            )}
            
            {/* Information for superadmin */}
            {isAdmin && (
              <Typography variant="body2" sx={{ mb: 2, p: 2, bgcolor: 'rgba(255, 193, 7, 0.1)', borderRadius: 1 }}>
                **Admin Mode**: You can manage all images<br/>
                **Approve** - approve image for public access
              </Typography>
            )}
            
            {/* Filters for superadmin for images */}
            {isAdmin && (
              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeNotPublishedImages}
                      onChange={(e) => setIncludeNotPublishedImages(e.target.checked)}
                    />
                  }
                  label="Include not published images"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={onlyMyImages}
                      onChange={(e) => setOnlyMyImages(e.target.checked)}
                    />
                  }
                  label="Only my images"
                />
              </Box>
            )}
            
            {imagesLoading ? (
              <Typography>Loading images...</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {images.length > 0 ? (
                  images.map((image: any) => (
                    <Box key={image.id} sx={{ width: { xs: '100%', sm: '45%', md: '30%', lg: '23%' } }}>
                      <Card>
                        <CardMedia
                          component="img"
                          height="120"
                          image={`${API_BASE}${image.image_url}`}
                          alt={image.name}
                        />
                        <CardContent>
                          <Typography variant="subtitle1">{image.name}</Typography>
                          <Typography variant="body2">Class: {image.class}</Typography>
                          <Typography variant="body2">Genre: {image.genre || 'None'}</Typography>
                          <Typography variant="body2">Owner: {image.owner}</Typography>
                          <Typography variant="body2">Uses: {image.uses}</Typography>
                          <Typography variant="body2">Approved: {image.approved ? 'Yes' : 'No'}</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                            Created: {new Date(image.created_at).toLocaleDateString()}
                          </Typography>
                        </CardContent>
                        <CardActions sx={{ flexWrap: 'wrap', gap: 1 }}>
                          {/* Approve button only for admin and non-approved images */}
                          {isAdmin && !image.approved && (
                            <Button size="small" color="success" onClick={() => handleApproveImage(image.id)}>
                              Approve
                            </Button>
                          )}
                          
                          {/* Delete button for owner of unpublished images or for admin */}
                          {((image.owner === address && !image.approved) || isAdmin) && (
                            <Button 
                              size="small"
                              color="warning"
                              onClick={() => handleDeleteImage(image.id)}
                              sx={{ border: '1px solid #ed6c02' }}
                            >
                              DELETE
                            </Button>
                          )}
                        </CardActions>
                      </Card>
                    </Box>
                  ))
                ) : (
                  <Typography>No images found</Typography>
                )}
              </Box>
            )}
          </TabPanel>

          {/* Users Tab - Admin Only */}
          {isAdmin && (
            <TabPanel value={tabValue} index={4}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Users Management
              </Typography>
              
              <Typography variant="body2" sx={{ mb: 2, p: 2, bgcolor: 'rgba(255, 193, 7, 0.1)', borderRadius: 1 }}>
                **Admin Mode**: View and manage all registered users
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={loadUsers}
                  disabled={usersLoading}
                >
                  {usersLoading ? 'Loading...' : 'Refresh Users'}
                </Button>
                <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                  Total users: {users.length}
                </Typography>
              </Box>
              
              {usersLoading ? (
                <Typography>Loading users...</Typography>
              ) : (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {users.length > 0 ? (
                      users.map((user: any, index: number) => (
                        <Card key={user.address || index} sx={{ 
                          backgroundColor: user.address === address ? 'rgba(25, 118, 210, 0.05)' : 'inherit',
                          border: user.address === address ? '1px solid rgba(25, 118, 210, 0.3)' : 'none'
                        }}>
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                              <Typography variant="h6">
                                {user.username || 'No username'}
                                {user.address === address && (
                                  <Typography component="span" variant="caption" sx={{ ml: 1, color: 'primary.main', fontWeight: 'bold' }}>
                                    (You)
                                  </Typography>
                                )}
                              </Typography>
                              {user.address === SUPREME_ADMIN && (
                                <Typography variant="caption" sx={{ 
                                  bgcolor: 'error.main', 
                                  color: 'white', 
                                  px: 1, 
                                  py: 0.5, 
                                  borderRadius: 1,
                                  fontWeight: 'bold'
                                }}>
                                  SUPER ADMIN
                                </Typography>
                              )}
                            </Box>
                            <Typography variant="body2" sx={{ wordBreak: 'break-all', mb: 1 }}>
                              <strong>Address:</strong> {user.address}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 3, mb: 1 }}>
                              <Typography variant="body2">
                                <strong>Presets:</strong> {user.presets_count || 0}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Images:</strong> {user.images_count || 0}
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                              <strong>Registered:</strong> {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                            </Typography>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <Typography>No users found</Typography>
                    )}
                  </Box>
              )}
            </TabPanel>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProfileDialog; 