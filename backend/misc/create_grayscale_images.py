""" Creates grayscale versions of each teams' logo. """

from PIL import Image, ImageEnhance
import os


if __name__ == "__main__":
    images_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'img')
    print(images_dir)
    assert os.path.exists(images_dir)
    for img_file in os.listdir(images_dir):
        try:
            if img_file.endswith('grayscale.png') or not img_file.endswith('.png'):
                continue
            img = Image.open(os.path.join(images_dir, img_file)).convert('RGBA')
            img = img.convert('LA')
            brightener = ImageEnhance.Brightness(img)
            img = brightener.enhance(1.2)

            alpha_channel = img.getchannel('A')
            new_alpha = alpha_channel.point(lambda i: 96 if i>0 else 0)
            img.putalpha(new_alpha)
            outfile = os.path.join(images_dir, img_file.split('.')[0] + '_grayscale.png')
            img.save(outfile)
        except:
            raise
