from PIL import Image
import os

# Create pics directory if it doesn't exist
if not os.path.exists('pics'):
    os.makedirs('pics')

# Create a 1x1 transparent PNG
img = Image.new('RGBA', (1, 1), (0, 0, 0, 0))
img.save('pics/empty.png', 'PNG') 