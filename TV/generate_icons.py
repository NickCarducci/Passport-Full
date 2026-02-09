from PIL import Image
import os
import argparse

def generate_icons(source_path, output_dir):
    """
    Generates the required manifest icons from a high-resolution source image.
    """
    if not os.path.exists(source_path):
        print(f"Error: Source image not found at '{os.path.abspath(source_path)}'. Please provide the correct path to your logo file.")
        return

    try:
        with Image.open(source_path) as img:
            # Ensure output directory exists
            os.makedirs(output_dir, exist_ok=True)
            
            # Generate PNGs for manifest
            img.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(output_dir, "MU-logo-192.png"))
            img.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(output_dir, "MU-logo-512.png"))
            
            # Generate ICO for browser favicon (contains multiple sizes: 16, 24, 32, 64)
            img.save(os.path.join(output_dir, "MU-logo.ico"), format='ICO', sizes=[(16, 16), (24, 24), (32, 32), (64, 64)])
            
            print(f"Successfully generated icons in '{output_dir}' directory.")
    except Exception as e:
        print(f"An error occurred: {e}")

def main():
    parser = argparse.ArgumentParser(description="Generate manifest icons from a source image.")
    parser.add_argument("source", help="Path to the high-resolution source image (e.g., MU-logo-source.png).")
    parser.add_argument("--output", default="public", help="Output directory for the icons (default: public).")
    
    args = parser.parse_args()
    generate_icons(args.source, args.output)

if __name__ == "__main__":
    main()
