-- Seed ALL 92 tank configurations from client Excel data
-- Using device_serial as primary matching key (matches computerSerialId from API)
-- Device refs (D00001, etc.) and site names are for reference only

-- Clear existing data first (if re-running)
TRUNCATE public.tank_configurations CASCADE;

-- ACM (2.5 L/60s) - 4 devices
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s) VALUES
('Clyde', 'D00001', '10000000aa8464a1', 'CONC', 1, 1000, 2.5),
('Clyde', 'D00003', '00000000d1328278', 'TW', 2, 1000, 2.5),
('Epping', 'D00004', '000000005f9a19a7', 'FOAM', 1, 1000, 2.5),
('Epping', 'D00002', '00000000213ec38d', 'TW', 2, 1000, 2.5);

-- BORAL - QLD (5.0 L/60s) - 16 devices  
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s) VALUES
('Archerfield', 'D00011', '0000000072d8d4f3', 'CONC', 1, 1000, 5.0),
('Benowa', 'D00012', '000000007fb4a4af', 'CONC', 1, 1000, 5.0),
('Browns Plains', 'D00014', '10000000137ca1d7', 'CONC', 1, 1000, 5.0),
('Burleigh', 'D00006', '000000007ac97f59', 'CONC', 1, 1000, 5.0),
('Caloundra', 'D00008', '0000000041ac048f', 'FOAM', 1, 1000, 5.0),
('Capalaba', 'D00010', '76016100', 'CONC', 1, 1000, 5.0),
('Cleveland', 'D00013', '000000009cdfa7b5', 'CONC', 1, 1000, 5.0),
('Coopers Plains', 'D00015', '10000000c0e57c6f', 'CONC', 1, 1000, 5.0),
('Everton Park', 'D00005', '000000009925bcd3', 'CONC', 1, 1000, 5.0),
('Geebung', 'D00009', '00000000616cf95f', 'CONC', 1, 1000, 5.0),
('Ipswich', 'D00020', '000000007be65fca', 'CONC', 1, 1000, 5.0),
('Labrador', 'D00018', '10000000c6da5a64', 'CONC', 1, 1000, 5.0),
('Murarrie', 'D00016', '10000000172a90b1', 'CONC', 1, 1000, 5.0),
('Narangba', 'D00007', '000000001555fdbf', 'CONC', 1, 1000, 5.0),
('Redbank', 'D00017', '000000004f1b279b', 'CONC', 1, 1000, 5.0),
('Wacol', 'D00019', '00000000e81bac37', 'CONC', 1, 1000, 5.0);

-- CLEARY BROS (2.5 L/60s) - 1 device
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s) VALUES
('Albion Park', 'D00021', '100000003a40f952', 'TW', 2, 1000, 2.5);

-- Elora Test Device (INACTIVE) - 1 device
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s, active) VALUES
('Burleigh', 'D00022', '0000000003c0f8c0', 'CONC', 1, 1000, 5.0, false);

-- GUNLAKE (2.5 L/60s) - 10 devices
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s) VALUES
('Banksmeadow', 'D00023', '000000008eea9733', 'FOAM', 1, 1000, 2.5),
('Banksmeadow', 'D00027', '00000000f6dfc0e8', 'TW', 2, 1000, 2.5),
('Glendenning', 'D00032', '00000000ee4755ef', 'FOAM', 1, 1000, 2.5),
('Glendenning', 'D00030', '000000006d8e0866', 'TW', 2, 1000, 2.5),
('Prestons', 'D00031', '0000000023a73efc', 'FOAM', 1, 1000, 2.5),
('Prestons', 'D00025', '0000000015d63586', 'TW', 2, 1000, 2.5),
('Silverwater', 'D00026', '00000000af688293', 'FOAM', 1, 1000, 2.5),
('Silverwater', 'D00028', '00000000bf7c63d5', 'TW', 2, 1000, 2.5),
('Smeaton Grange', 'D00024', '00000000ff9dd2ad', 'FOAM', 1, 1000, 2.5),
('Smeaton Grange', 'D00029', '1000000074cfba9c', 'TW', 2, 1000, 2.5);

-- HAZELL BROS (2.5 L/60s) - 1 device
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s) VALUES
('Raeburn', 'D00033', '000000002c46d835', 'CONC', 1, 1000, 2.5);

-- HEIDELBERG MATERIALS - MELB METRO (2.5 L/60s) - 10 devices
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s) VALUES
('Brooklyn', 'D00039', '1000000007aa6f18', 'FOAM', 1, 1000, 2.5),
('Collingwood', 'D00043', '00000000ac518355', 'FOAM', 1, 1000, 2.5),
('Croydon', 'D00034', '00000000e7c85e79', 'FOAM', 1, 1000, 2.5),
('Dandenong South', 'D00038', '10000000a10a01cf', 'FOAM', 1, 1000, 2.5),
('Epping', 'D00042', '000000005712dae3', 'FOAM', 1, 1000, 2.5),
('Hoppers Crossing', 'D00041', '0000000012d44eb5', 'FOAM', 1, 1000, 2.5),
('Port Melbourne', 'D00037', '00000000cb775d23', 'FOAM', 1, 1000, 2.5),
('Somerton', 'D00035', '000000008423f222', 'FOAM', 1, 1000, 2.5),
('Westall', 'D00040', '00000000fe21c5da', 'FOAM', 1, 1000, 2.5),
('Wollert', 'D00036', '00000000677a7c7f', 'FOAM', 1, 1000, 2.5);

-- HEIDELBERG MATERIALS - NSW (2.5 L/60s) - 14 devices
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s) VALUES
('Artarmon', 'D00045', '1000000050db9682', 'CONC', 1, 1000, 2.5),
('Banksmeadow', 'D00049', '000000007379574b', 'CONC', 1, 1000, 2.5),
('Banksmeadow', 'D00056', '000000009b6c50f0', 'FOAM', 1, 1000, 2.5),
('Banksmeadow', 'D00050', '00000000f3d031e3', 'TW', 2, 1000, 2.5),
('Caringbah', 'D00044', '10000000abf2a60c', 'CONC', 1, 1000, 2.5),
('Greenacre', 'D00046', '0000000063a35be3', 'FOAM', 1, 1000, 2.5),
('Greenacre', 'D00047', '00000000aa5a9b24', 'CONC', 1, 1000, 2.5),
('Greenacre', 'D00057', '00000000d72a11f9', 'TW', 2, 1000, 2.5),
('Pendle Hill', 'D00054', '00000000902c2258', 'CONC', 1, 1000, 2.5),
('Pendle Hill', 'D00055', '0000000010d7416c', 'FOAM', 1, 1000, 2.5),
('Pendle Hill', 'D00048', '00000000137e6dad', 'TW', 2, 1000, 2.5),
('Prestons', 'D00051', '00000000841530f3', 'CONC', 1, 1000, 2.5),
('Prestons', 'D00052', '00000000bba9a972', 'FOAM', 1, 1000, 2.5),
('Prestons', 'D00053', '00000000bda16579', 'TW', 2, 1000, 2.5);

-- HEIDELBERG MATERIALS - VIC WEST (2.5 L/60s) - 2 devices
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s) VALUES
('Geelong', 'D00058', '000000006e11f0a4', 'CONC', 1, 1000, 2.5),
('Geelong', 'D00059', '0000000074c310ab', 'FOAM', 1, 1000, 2.5);

-- HEIDELBERG MATERIALS - WA (2.5 L/60s) - 10 devices
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s) VALUES
('Canning Vale', 'D00068', '000000005acf89af', 'CONC', 1, 1000, 2.5),
('Canning Vale', 'D00060', '00000000369c950f', 'TW', 2, 1000, 2.5),
('East Perth', 'D00063', '10000000232e1e7b', 'CONC', 1, 1000, 2.5),
('East Perth', 'D00069', '000000003e550d48', 'TW', 2, 1000, 2.5),
('Gnangara', 'D00067', '00000000fd8c72a9', 'CONC', 1, 1000, 2.5),
('Gnangara', 'D00066', '100000000eb4ea67', 'TW', 2, 1000, 2.5),
('Neerabup', 'D00064', '10000000e9806236', 'CONC', 1, 1000, 2.5),
('Neerabup', 'D00065', '100000002928e370', 'TW', 2, 1000, 2.5),
('Rockingham', 'D00061', '100000006560f676', 'CONC', 1, 1000, 2.5),
('Rockingham', 'D00062', '100000005d806a4f', 'TW', 2, 1000, 2.5);

-- HOLCIM - NSW (2.5 L/60s) - 4 devices
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s) VALUES
('Merotherie', 'D00073', '00000000d5edf745', 'FOAM', 1, 1000, 2.5),
('Merotherie', 'D00070', '10000000701d77d9', 'TW', 2, 1000, 2.5),
('Ulan', 'D00072', '00000000b8febe39', 'FOAM', 1, 1000, 2.5),
('Ulan', 'D00071', '00000000bb1fd25c', 'TW', 2, 1000, 2.5);

-- HOLCIM - VIC (2.5 L/60s) - 6 devices
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s) VALUES
('Bayswater', 'D00074', '000000007950bead', 'FOAM', 1, 1000, 2.5),
('Epping', 'D00078', '000000008aaa2ae3', 'FOAM', 1, 1000, 2.5),
('Epping', 'D00077', '00000000ccff9940', 'TW', 2, 1000, 2.5),
('Laverton', 'D00079', '1000000075362940', 'FOAM', 1, 1000, 2.5),
('Oaklands Junction', 'D00076', '000000004dc21757', 'FOAM', 1, 1000, 2.5),
('Oaklands Junction', 'D00075', '00000000bc11d216', 'TW', 2, 1000, 2.5);

-- HUNTER READY MIX (2.5 L/60s) - 2 devices
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s) VALUES
('Gateshead', 'D00081', '10000000ebd15d96', 'CONC', 1, 1000, 2.5),
('Thornton', 'D00080', '0000000041b4f25f', 'FOAM', 1, 1000, 2.5);

-- NUCON (5.0 L/60s) - 1 device
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s) VALUES
('Burleigh', 'D00082', '000000000aeb1dd8', 'CONC', 1, 1000, 5.0);

-- REGIONAL GROUP (2.5 L/60s) - 2 devices
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s) VALUES
('Tamworth', 'D00083', '1000000034d7d8fa', 'CONC', 1, 1000, 2.5),
('Tamworth', 'D00084', '00000000c9b5d417', 'FOAM', 1, 1000, 2.5);

-- SUNMIX CONCRETE (5.0 L/60s) - 4 devices
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s) VALUES
('Beaudesert', 'D00085', '0000000021a53789', 'FOAM', 1, 1000, 5.0),
('Kingston', 'D00086', '10000000fd50e8df', 'FOAM', 1, 1000, 5.0),
('Kingston', 'D00087', '10000000ab856208', 'GEL', 1, 1000, 5.0),
('Swanbank', 'D00088', '10000000023eacf2', 'FOAM', 1, 1000, 5.0);

-- WAGNERS (5.0 L/60s) - 4 devices
INSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s) VALUES
('Pinkenba', 'D00089', '10000000a7853d34', 'CONC', 1, 1000, 5.0),
('Pinkenba', 'D00090', '10000000d10cedc0', 'TW', 2, 1000, 5.0),
('Toowoomba', 'D00092', '00000000fe66ab23', 'CONC', 1, 1000, 5.0),
('Toowoomba', 'D00091', '10000000070fef22', 'TW', 2, 1000, 5.0);

-- Verify count
SELECT 
  COUNT(*) as total_configs,
  COUNT(DISTINCT device_serial) as unique_devices,
  COUNT(*) FILTER (WHERE active = true) as active_configs
FROM public.tank_configurations;
