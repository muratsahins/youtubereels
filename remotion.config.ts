import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
// Shorts yeniden sıkıştırdığı için kaynağı yüksek kalitede veriyoruz.
Config.setCrf(18);
Config.setOverwriteOutput(true);
