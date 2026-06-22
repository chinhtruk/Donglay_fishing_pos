-- MySQL dump 10.13  Distrib 9.6.0, for macos26.4 (arm64)
--
-- Host: 127.0.0.1    Database: donglay_fishing
-- ------------------------------------------------------
-- Server version	9.6.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '625b413c-6c8d-11f1-941e-b61d6fd4dac7:1-38165';

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `action` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `auditable_type` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `auditable_id` bigint unsigned NOT NULL,
  `before` json DEFAULT NULL,
  `after` json DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_logs_user_id_foreign` (`user_id`),
  KEY `audit_logs_auditable_type_auditable_id_index` (`auditable_type`,`auditable_id`),
  KEY `audit_logs_action_index` (`action`),
  CONSTRAINT `audit_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache`
--

DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache`
--

LOCK TABLES `cache` WRITE;
/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
INSERT INTO `cache` VALUES ('dong-lay-fishing-cache-5c785c036466adea360111aa28563bfd556b5fba','i:1;',1782083889),('dong-lay-fishing-cache-5c785c036466adea360111aa28563bfd556b5fba:timer','i:1782083889;',1782083889);
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache_locks`
--

DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache_locks`
--

LOCK TABLES `cache_locks` WRITE;
/*!40000 ALTER TABLE `cache_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_locks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coffee_tables`
--

DROP TABLE IF EXISTS `coffee_tables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coffee_tables` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `label` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `position_x` decimal(5,2) NOT NULL DEFAULT '50.00',
  `position_y` decimal(5,2) NOT NULL DEFAULT '50.00',
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coffee_tables`
--

LOCK TABLES `coffee_tables` WRITE;
/*!40000 ALTER TABLE `coffee_tables` DISABLE KEYS */;
INSERT INTO `coffee_tables` VALUES (1,'Bàn 1',10.00,15.00,1,'2026-06-20 10:07:53','2026-06-21 14:05:35'),(2,'Bàn 2',30.00,15.00,1,'2026-06-20 10:07:53','2026-06-21 14:05:38'),(3,'Bàn 3',50.00,15.00,1,'2026-06-20 10:07:53','2026-06-20 13:05:40'),(4,'Bàn 4',70.00,15.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(5,'Bàn 5',90.00,15.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(6,'Bàn 6',10.00,38.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(7,'Bàn 7',30.00,38.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(8,'Bàn 8',50.00,38.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(9,'Bàn 9',70.00,38.00,1,'2026-06-20 10:07:53','2026-06-21 14:05:42'),(10,'Bàn 10',90.00,38.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(11,'Bàn 11',10.00,61.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(12,'Bàn 12',30.00,61.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(13,'Bàn 13',50.00,61.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(14,'Bàn 14',70.00,61.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(15,'Bàn 15',90.00,61.00,1,'2026-06-20 10:07:53','2026-06-21 14:05:44'),(16,'Bàn 16',10.00,84.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(17,'Bàn 17',30.00,84.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(18,'Bàn 18',50.00,84.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(19,'Bàn 19',70.00,84.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(20,'Bàn 20',90.00,84.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53');
/*!40000 ALTER TABLE `coffee_tables` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `failed_jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `exception` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`),
  KEY `failed_jobs_connection_queue_failed_at_index` (`connection`,`queue`,`failed_at`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_jobs`
--

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
INSERT INTO `failed_jobs` VALUES (1,'e24bb78c-aab9-4a98-b152-18adef42a830','database','default','{\"uuid\":\"e24bb78c-aab9-4a98-b152-18adef42a830\",\"displayName\":\"App\\\\Mail\\\\EmployeeOtpMail\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"deleteWhenMissingModels\":false,\"data\":{\"commandName\":\"Illuminate\\\\Mail\\\\SendQueuedMailable\",\"command\":\"O:34:\\\"Illuminate\\\\Mail\\\\SendQueuedMailable\\\":18:{s:8:\\\"mailable\\\";O:24:\\\"App\\\\Mail\\\\EmployeeOtpMail\\\":3:{s:4:\\\"code\\\";s:6:\\\"612910\\\";s:2:\\\"to\\\";a:1:{i:0;a:2:{s:4:\\\"name\\\";N;s:7:\\\"address\\\";s:23:\\\"nguyentruc766@gmail.com\\\";}}s:6:\\\"mailer\\\";s:4:\\\"smtp\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:13:\\\"maxExceptions\\\";N;s:17:\\\"shouldBeEncrypted\\\";b:0;s:3:\\\"job\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:12:\\\"deduplicator\\\";N;s:13:\\\"debounceOwner\\\";s:0:\\\"\\\";s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\",\"batchId\":null},\"createdAt\":1781950926,\"delay\":null}','Symfony\\Component\\Mailer\\Exception\\TransportException: Connection could not be established with host \"127.0.0.1:2525\": stream_socket_client(): Unable to connect to 127.0.0.1:2525 (Connection refused) in /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/mailer/Transport/Smtp/Stream/SocketStream.php:154\nStack trace:\n#0 [internal function]: Symfony\\Component\\Mailer\\Transport\\Smtp\\Stream\\SocketStream->{closure:Symfony\\Component\\Mailer\\Transport\\Smtp\\Stream\\SocketStream::initialize():153}(2, \'stream_socket_c...\', \'/Volumes/Data/P...\', 157)\n#1 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/mailer/Transport/Smtp/Stream/SocketStream.php(157): stream_socket_client(\'127.0.0.1:2525\', 0, \'\', 60.0, 4, Resource id #964)\n#2 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/mailer/Transport/Smtp/SmtpTransport.php(268): Symfony\\Component\\Mailer\\Transport\\Smtp\\Stream\\SocketStream->initialize()\n#3 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/mailer/Transport/Smtp/SmtpTransport.php(200): Symfony\\Component\\Mailer\\Transport\\Smtp\\SmtpTransport->start()\n#4 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/mailer/Transport/AbstractTransport.php(69): Symfony\\Component\\Mailer\\Transport\\Smtp\\SmtpTransport->doSend(Object(Symfony\\Component\\Mailer\\SentMessage))\n#5 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/mailer/Transport/Smtp/SmtpTransport.php(138): Symfony\\Component\\Mailer\\Transport\\AbstractTransport->send(Object(Symfony\\Component\\Mime\\Email), Object(Symfony\\Component\\Mailer\\DelayedEnvelope))\n#6 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Mail/Mailer.php(584): Symfony\\Component\\Mailer\\Transport\\Smtp\\SmtpTransport->send(Object(Symfony\\Component\\Mime\\Email), Object(Symfony\\Component\\Mailer\\DelayedEnvelope))\n#7 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Mail/Mailer.php(331): Illuminate\\Mail\\Mailer->sendSymfonyMessage(Object(Symfony\\Component\\Mime\\Email))\n#8 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Mail/Mailable.php(211): Illuminate\\Mail\\Mailer->send(\'mail.employee-o...\', Array, Object(Closure))\n#9 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Support/Traits/Localizable.php(21): Illuminate\\Mail\\Mailable->{closure:Illuminate\\Mail\\Mailable::send():204}()\n#10 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Mail/Mailable.php(204): Illuminate\\Mail\\Mailable->withLocale(NULL, Object(Closure))\n#11 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Mail/SendQueuedMailable.php(89): Illuminate\\Mail\\Mailable->send(Object(Illuminate\\Mail\\MailManager))\n#12 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(36): Illuminate\\Mail\\SendQueuedMailable->handle(Object(Illuminate\\Mail\\MailManager))\n#13 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/Util.php(43): Illuminate\\Container\\BoundMethod::{closure:Illuminate\\Container\\BoundMethod::call():35}()\n#14 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(96): Illuminate\\Container\\Util::unwrapIfClosure(Object(Closure))\n#15 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(35): Illuminate\\Container\\BoundMethod::callBoundMethod(Object(Illuminate\\Foundation\\Application), Array, Object(Closure))\n#16 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/Container.php(799): Illuminate\\Container\\BoundMethod::call(Object(Illuminate\\Foundation\\Application), Array, Array, NULL)\n#17 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Bus/Dispatcher.php(136): Illuminate\\Container\\Container->call(Array)\n#18 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Pipeline/Pipeline.php(180): Illuminate\\Bus\\Dispatcher->{closure:Illuminate\\Bus\\Dispatcher::dispatchNow():133}(Object(Illuminate\\Mail\\SendQueuedMailable))\n#19 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Pipeline/Pipeline.php(137): Illuminate\\Pipeline\\Pipeline->{closure:Illuminate\\Pipeline\\Pipeline::prepareDestination():178}(Object(Illuminate\\Mail\\SendQueuedMailable))\n#20 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Bus/Dispatcher.php(140): Illuminate\\Pipeline\\Pipeline->then(Object(Closure))\n#21 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php(153): Illuminate\\Bus\\Dispatcher->dispatchNow(Object(Illuminate\\Mail\\SendQueuedMailable), false)\n#22 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Pipeline/Pipeline.php(180): Illuminate\\Queue\\CallQueuedHandler->{closure:Illuminate\\Queue\\CallQueuedHandler::dispatchThroughMiddleware():146}(Object(Illuminate\\Mail\\SendQueuedMailable))\n#23 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Pipeline/Pipeline.php(137): Illuminate\\Pipeline\\Pipeline->{closure:Illuminate\\Pipeline\\Pipeline::prepareDestination():178}(Object(Illuminate\\Mail\\SendQueuedMailable))\n#24 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php(146): Illuminate\\Pipeline\\Pipeline->then(Object(Closure))\n#25 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php(84): Illuminate\\Queue\\CallQueuedHandler->dispatchThroughMiddleware(Object(Illuminate\\Queue\\Jobs\\DatabaseJob), Object(Illuminate\\Mail\\SendQueuedMailable))\n#26 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/Jobs/Job.php(102): Illuminate\\Queue\\CallQueuedHandler->call(Object(Illuminate\\Queue\\Jobs\\DatabaseJob), Array)\n#27 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(553): Illuminate\\Queue\\Jobs\\Job->fire()\n#28 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(499): Illuminate\\Queue\\Worker->process(\'database\', Object(Illuminate\\Queue\\Jobs\\DatabaseJob), Object(Illuminate\\Queue\\WorkerOptions))\n#29 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(245): Illuminate\\Queue\\Worker->runJob(Object(Illuminate\\Queue\\Jobs\\DatabaseJob), \'database\', Object(Illuminate\\Queue\\WorkerOptions))\n#30 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/Console/WorkCommand.php(149): Illuminate\\Queue\\Worker->daemon(\'database\', \'default\', Object(Illuminate\\Queue\\WorkerOptions))\n#31 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/Console/WorkCommand.php(132): Illuminate\\Queue\\Console\\WorkCommand->runWorker(\'database\', \'default\')\n#32 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(36): Illuminate\\Queue\\Console\\WorkCommand->handle()\n#33 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/Util.php(43): Illuminate\\Container\\BoundMethod::{closure:Illuminate\\Container\\BoundMethod::call():35}()\n#34 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(96): Illuminate\\Container\\Util::unwrapIfClosure(Object(Closure))\n#35 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(35): Illuminate\\Container\\BoundMethod::callBoundMethod(Object(Illuminate\\Foundation\\Application), Array, Object(Closure))\n#36 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/Container.php(799): Illuminate\\Container\\BoundMethod::call(Object(Illuminate\\Foundation\\Application), Array, Array, NULL)\n#37 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Console/Command.php(280): Illuminate\\Container\\Container->call(Array)\n#38 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/console/Command/Command.php(284): Illuminate\\Console\\Command->execute(Object(Symfony\\Component\\Console\\Input\\ArgvInput), Object(Laravel\\Pao\\Laravel\\PaoOutputStyle))\n#39 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Console/Command.php(249): Symfony\\Component\\Console\\Command\\Command->run(Object(Symfony\\Component\\Console\\Input\\ArgvInput), Object(Laravel\\Pao\\Laravel\\PaoOutputStyle))\n#40 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/console/Application.php(1144): Illuminate\\Console\\Command->run(Object(Symfony\\Component\\Console\\Input\\ArgvInput), Object(Symfony\\Component\\Console\\Output\\ConsoleOutput))\n#41 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/console/Application.php(379): Symfony\\Component\\Console\\Application->doRunCommand(Object(Illuminate\\Queue\\Console\\WorkCommand), Object(Symfony\\Component\\Console\\Input\\ArgvInput), Object(Symfony\\Component\\Console\\Output\\ConsoleOutput))\n#42 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/console/Application.php(218): Symfony\\Component\\Console\\Application->doRun(Object(Symfony\\Component\\Console\\Input\\ArgvInput), Object(Symfony\\Component\\Console\\Output\\ConsoleOutput))\n#43 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Foundation/Console/Kernel.php(198): Symfony\\Component\\Console\\Application->run(Object(Symfony\\Component\\Console\\Input\\ArgvInput), Object(Symfony\\Component\\Console\\Output\\ConsoleOutput))\n#44 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Foundation/Application.php(1235): Illuminate\\Foundation\\Console\\Kernel->handle(Object(Symfony\\Component\\Console\\Input\\ArgvInput), Object(Symfony\\Component\\Console\\Output\\ConsoleOutput))\n#45 /Volumes/Data/Projects/Donglay_fishing/artisan(16): Illuminate\\Foundation\\Application->handleCommand(Object(Symfony\\Component\\Console\\Input\\ArgvInput))\n#46 {main}','2026-06-20 10:22:08'),(2,'8dc540d6-8bb1-4f0b-a3c7-48718fb18711','database','default','{\"uuid\":\"8dc540d6-8bb1-4f0b-a3c7-48718fb18711\",\"displayName\":\"App\\\\Mail\\\\EmployeeOtpMail\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"deleteWhenMissingModels\":false,\"data\":{\"commandName\":\"Illuminate\\\\Mail\\\\SendQueuedMailable\",\"command\":\"O:34:\\\"Illuminate\\\\Mail\\\\SendQueuedMailable\\\":18:{s:8:\\\"mailable\\\";O:24:\\\"App\\\\Mail\\\\EmployeeOtpMail\\\":3:{s:4:\\\"code\\\";s:6:\\\"643472\\\";s:2:\\\"to\\\";a:1:{i:0;a:2:{s:4:\\\"name\\\";N;s:7:\\\"address\\\";s:23:\\\"nguyentruc766@gmail.com\\\";}}s:6:\\\"mailer\\\";s:4:\\\"smtp\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:13:\\\"maxExceptions\\\";N;s:17:\\\"shouldBeEncrypted\\\";b:0;s:3:\\\"job\\\";N;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:12:\\\"messageGroup\\\";N;s:12:\\\"deduplicator\\\";N;s:13:\\\"debounceOwner\\\";s:0:\\\"\\\";s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;}\",\"batchId\":null},\"createdAt\":1781951137,\"delay\":null}','Symfony\\Component\\Mailer\\Exception\\TransportException: Connection could not be established with host \"127.0.0.1:2525\": stream_socket_client(): Unable to connect to 127.0.0.1:2525 (Connection refused) in /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/mailer/Transport/Smtp/Stream/SocketStream.php:154\nStack trace:\n#0 [internal function]: Symfony\\Component\\Mailer\\Transport\\Smtp\\Stream\\SocketStream->{closure:Symfony\\Component\\Mailer\\Transport\\Smtp\\Stream\\SocketStream::initialize():153}(2, \'stream_socket_c...\', \'/Volumes/Data/P...\', 157)\n#1 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/mailer/Transport/Smtp/Stream/SocketStream.php(157): stream_socket_client(\'127.0.0.1:2525\', 0, \'\', 60.0, 4, Resource id #978)\n#2 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/mailer/Transport/Smtp/SmtpTransport.php(268): Symfony\\Component\\Mailer\\Transport\\Smtp\\Stream\\SocketStream->initialize()\n#3 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/mailer/Transport/Smtp/SmtpTransport.php(200): Symfony\\Component\\Mailer\\Transport\\Smtp\\SmtpTransport->start()\n#4 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/mailer/Transport/AbstractTransport.php(69): Symfony\\Component\\Mailer\\Transport\\Smtp\\SmtpTransport->doSend(Object(Symfony\\Component\\Mailer\\SentMessage))\n#5 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/mailer/Transport/Smtp/SmtpTransport.php(138): Symfony\\Component\\Mailer\\Transport\\AbstractTransport->send(Object(Symfony\\Component\\Mime\\Email), Object(Symfony\\Component\\Mailer\\DelayedEnvelope))\n#6 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Mail/Mailer.php(584): Symfony\\Component\\Mailer\\Transport\\Smtp\\SmtpTransport->send(Object(Symfony\\Component\\Mime\\Email), Object(Symfony\\Component\\Mailer\\DelayedEnvelope))\n#7 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Mail/Mailer.php(331): Illuminate\\Mail\\Mailer->sendSymfonyMessage(Object(Symfony\\Component\\Mime\\Email))\n#8 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Mail/Mailable.php(211): Illuminate\\Mail\\Mailer->send(\'mail.employee-o...\', Array, Object(Closure))\n#9 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Support/Traits/Localizable.php(21): Illuminate\\Mail\\Mailable->{closure:Illuminate\\Mail\\Mailable::send():204}()\n#10 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Mail/Mailable.php(204): Illuminate\\Mail\\Mailable->withLocale(NULL, Object(Closure))\n#11 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Mail/SendQueuedMailable.php(89): Illuminate\\Mail\\Mailable->send(Object(Illuminate\\Mail\\MailManager))\n#12 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(36): Illuminate\\Mail\\SendQueuedMailable->handle(Object(Illuminate\\Mail\\MailManager))\n#13 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/Util.php(43): Illuminate\\Container\\BoundMethod::{closure:Illuminate\\Container\\BoundMethod::call():35}()\n#14 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(96): Illuminate\\Container\\Util::unwrapIfClosure(Object(Closure))\n#15 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(35): Illuminate\\Container\\BoundMethod::callBoundMethod(Object(Illuminate\\Foundation\\Application), Array, Object(Closure))\n#16 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/Container.php(799): Illuminate\\Container\\BoundMethod::call(Object(Illuminate\\Foundation\\Application), Array, Array, NULL)\n#17 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Bus/Dispatcher.php(136): Illuminate\\Container\\Container->call(Array)\n#18 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Pipeline/Pipeline.php(180): Illuminate\\Bus\\Dispatcher->{closure:Illuminate\\Bus\\Dispatcher::dispatchNow():133}(Object(Illuminate\\Mail\\SendQueuedMailable))\n#19 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Pipeline/Pipeline.php(137): Illuminate\\Pipeline\\Pipeline->{closure:Illuminate\\Pipeline\\Pipeline::prepareDestination():178}(Object(Illuminate\\Mail\\SendQueuedMailable))\n#20 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Bus/Dispatcher.php(140): Illuminate\\Pipeline\\Pipeline->then(Object(Closure))\n#21 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php(153): Illuminate\\Bus\\Dispatcher->dispatchNow(Object(Illuminate\\Mail\\SendQueuedMailable), false)\n#22 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Pipeline/Pipeline.php(180): Illuminate\\Queue\\CallQueuedHandler->{closure:Illuminate\\Queue\\CallQueuedHandler::dispatchThroughMiddleware():146}(Object(Illuminate\\Mail\\SendQueuedMailable))\n#23 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Pipeline/Pipeline.php(137): Illuminate\\Pipeline\\Pipeline->{closure:Illuminate\\Pipeline\\Pipeline::prepareDestination():178}(Object(Illuminate\\Mail\\SendQueuedMailable))\n#24 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php(146): Illuminate\\Pipeline\\Pipeline->then(Object(Closure))\n#25 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php(84): Illuminate\\Queue\\CallQueuedHandler->dispatchThroughMiddleware(Object(Illuminate\\Queue\\Jobs\\DatabaseJob), Object(Illuminate\\Mail\\SendQueuedMailable))\n#26 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/Jobs/Job.php(102): Illuminate\\Queue\\CallQueuedHandler->call(Object(Illuminate\\Queue\\Jobs\\DatabaseJob), Array)\n#27 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(553): Illuminate\\Queue\\Jobs\\Job->fire()\n#28 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(499): Illuminate\\Queue\\Worker->process(\'database\', Object(Illuminate\\Queue\\Jobs\\DatabaseJob), Object(Illuminate\\Queue\\WorkerOptions))\n#29 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(245): Illuminate\\Queue\\Worker->runJob(Object(Illuminate\\Queue\\Jobs\\DatabaseJob), \'database\', Object(Illuminate\\Queue\\WorkerOptions))\n#30 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/Console/WorkCommand.php(149): Illuminate\\Queue\\Worker->daemon(\'database\', \'default\', Object(Illuminate\\Queue\\WorkerOptions))\n#31 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Queue/Console/WorkCommand.php(132): Illuminate\\Queue\\Console\\WorkCommand->runWorker(\'database\', \'default\')\n#32 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(36): Illuminate\\Queue\\Console\\WorkCommand->handle()\n#33 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/Util.php(43): Illuminate\\Container\\BoundMethod::{closure:Illuminate\\Container\\BoundMethod::call():35}()\n#34 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(96): Illuminate\\Container\\Util::unwrapIfClosure(Object(Closure))\n#35 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(35): Illuminate\\Container\\BoundMethod::callBoundMethod(Object(Illuminate\\Foundation\\Application), Array, Object(Closure))\n#36 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Container/Container.php(799): Illuminate\\Container\\BoundMethod::call(Object(Illuminate\\Foundation\\Application), Array, Array, NULL)\n#37 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Console/Command.php(280): Illuminate\\Container\\Container->call(Array)\n#38 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/console/Command/Command.php(284): Illuminate\\Console\\Command->execute(Object(Symfony\\Component\\Console\\Input\\ArgvInput), Object(Laravel\\Pao\\Laravel\\PaoOutputStyle))\n#39 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Console/Command.php(249): Symfony\\Component\\Console\\Command\\Command->run(Object(Symfony\\Component\\Console\\Input\\ArgvInput), Object(Laravel\\Pao\\Laravel\\PaoOutputStyle))\n#40 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/console/Application.php(1144): Illuminate\\Console\\Command->run(Object(Symfony\\Component\\Console\\Input\\ArgvInput), Object(Symfony\\Component\\Console\\Output\\ConsoleOutput))\n#41 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/console/Application.php(379): Symfony\\Component\\Console\\Application->doRunCommand(Object(Illuminate\\Queue\\Console\\WorkCommand), Object(Symfony\\Component\\Console\\Input\\ArgvInput), Object(Symfony\\Component\\Console\\Output\\ConsoleOutput))\n#42 /Volumes/Data/Projects/Donglay_fishing/vendor/symfony/console/Application.php(218): Symfony\\Component\\Console\\Application->doRun(Object(Symfony\\Component\\Console\\Input\\ArgvInput), Object(Symfony\\Component\\Console\\Output\\ConsoleOutput))\n#43 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Foundation/Console/Kernel.php(198): Symfony\\Component\\Console\\Application->run(Object(Symfony\\Component\\Console\\Input\\ArgvInput), Object(Symfony\\Component\\Console\\Output\\ConsoleOutput))\n#44 /Volumes/Data/Projects/Donglay_fishing/vendor/laravel/framework/src/Illuminate/Foundation/Application.php(1235): Illuminate\\Foundation\\Console\\Kernel->handle(Object(Symfony\\Component\\Console\\Input\\ArgvInput), Object(Symfony\\Component\\Console\\Output\\ConsoleOutput))\n#45 /Volumes/Data/Projects/Donglay_fishing/artisan(16): Illuminate\\Foundation\\Application->handleCommand(Object(Symfony\\Component\\Console\\Input\\ArgvInput))\n#46 {main}','2026-06-20 10:25:38');
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fishing_sessions`
--

DROP TABLE IF EXISTS `fishing_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fishing_sessions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `fishing_spot_id` bigint unsigned NOT NULL,
  `started_at` timestamp NOT NULL,
  `ends_at` timestamp NOT NULL,
  `blocks_count` int unsigned NOT NULL DEFAULT '1',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `expired_notified_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fishing_sessions_order_id_unique` (`order_id`),
  KEY `fishing_sessions_fishing_spot_id_foreign` (`fishing_spot_id`),
  KEY `fishing_sessions_ends_at_index` (`ends_at`),
  KEY `fishing_sessions_status_index` (`status`),
  CONSTRAINT `fishing_sessions_fishing_spot_id_foreign` FOREIGN KEY (`fishing_spot_id`) REFERENCES `fishing_spots` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fishing_sessions_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fishing_sessions`
--

LOCK TABLES `fishing_sessions` WRITE;
/*!40000 ALTER TABLE `fishing_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `fishing_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fishing_spots`
--

DROP TABLE IF EXISTS `fishing_spots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fishing_spots` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `label` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `position_x` decimal(5,2) NOT NULL DEFAULT '50.00',
  `position_y` decimal(5,2) NOT NULL DEFAULT '50.00',
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fishing_spots`
--

LOCK TABLES `fishing_spots` WRITE;
/*!40000 ALTER TABLE `fishing_spots` DISABLE KEYS */;
INSERT INTO `fishing_spots` VALUES (1,'Chòi 1',8.00,12.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(2,'Chòi 2',29.00,12.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(3,'Chòi 3',50.00,12.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(4,'Chòi 4',71.00,12.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(5,'Chòi 5',92.00,12.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(6,'Chòi 6',8.00,36.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(7,'Chòi 7',29.00,36.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(8,'Chòi 8',50.00,36.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(9,'Chòi 9',71.00,36.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(10,'Chòi 10',92.00,36.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(11,'Chòi 11',8.00,60.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(12,'Chòi 12',29.00,60.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(13,'Chòi 13',50.00,60.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(14,'Chòi 14',71.00,60.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(15,'Chòi 15',92.00,60.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(16,'Chòi 16',8.00,84.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(17,'Chòi 17',29.00,84.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(18,'Chòi 18',50.00,84.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(19,'Chòi 19',71.00,84.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53'),(20,'Chòi 20',92.00,84.00,1,'2026-06-20 10:07:53','2026-06-20 10:07:53');
/*!40000 ALTER TABLE `fishing_spots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_batches`
--

DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_jobs` int NOT NULL,
  `pending_jobs` int NOT NULL,
  `failed_jobs` int NOT NULL,
  `failed_job_ids` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `options` mediumtext COLLATE utf8mb4_unicode_ci,
  `cancelled_at` int DEFAULT NULL,
  `created_at` int NOT NULL,
  `finished_at` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_batches`
--

LOCK TABLES `job_batches` WRITE;
/*!40000 ALTER TABLE `job_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` smallint unsigned NOT NULL,
  `reserved_at` int unsigned DEFAULT NULL,
  `available_at` int unsigned NOT NULL,
  `created_at` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `menu_categories`
--

DROP TABLE IF EXISTS `menu_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `menu_categories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int unsigned NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `menu_categories_name_unique` (`name`),
  KEY `menu_categories_is_active_index` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `menu_categories`
--

LOCK TABLES `menu_categories` WRITE;
/*!40000 ALTER TABLE `menu_categories` DISABLE KEYS */;
INSERT INTO `menu_categories` VALUES (1,'View',1,1,'2026-06-21 18:15:24','2026-06-21 18:15:24'),(2,'Cà phê',2,1,'2026-06-21 19:01:25','2026-06-21 19:01:25'),(3,'Món nóng',3,1,'2026-06-21 19:31:03','2026-06-21 19:31:03'),(4,'Trà',4,1,'2026-06-21 19:33:36','2026-06-21 19:33:36'),(5,'Nước ngọt',5,1,'2026-06-21 19:35:50','2026-06-21 19:35:50'),(6,'Matcha latte',6,1,'2026-06-21 19:39:33','2026-06-21 19:39:33'),(7,'Sữa chua',7,1,'2026-06-21 19:41:12','2026-06-21 19:41:12'),(8,'Soda',8,1,'2026-06-21 19:42:21','2026-06-21 19:42:21'),(9,'Trà sữa',9,1,'2026-06-21 19:43:05','2026-06-21 19:43:05'),(10,'Siro',10,1,'2026-06-21 19:45:32','2026-06-21 19:45:32'),(11,'Nước ép',11,1,'2026-06-21 19:46:56','2026-06-21 19:46:56'),(12,'Ăn vặt',12,1,'2026-06-21 20:01:58','2026-06-21 20:01:58');
/*!40000 ALTER TABLE `menu_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `menu_items`
--

DROP TABLE IF EXISTS `menu_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `menu_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `category` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_id` bigint unsigned DEFAULT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `image_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price` decimal(14,2) NOT NULL,
  `display_price` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_available` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `menu_items_category_index` (`category`),
  KEY `menu_items_is_available_index` (`is_available`),
  KEY `menu_items_category_id_foreign` (`category_id`),
  CONSTRAINT `menu_items_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `menu_categories` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=145 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `menu_items`
--

LOCK TABLES `menu_items` WRITE;
/*!40000 ALTER TABLE `menu_items` DISABLE KEYS */;
INSERT INTO `menu_items` VALUES (1,'View',1,'View ăn uống',NULL,NULL,50000.00,NULL,1,'2026-06-21 18:15:24','2026-06-21 19:29:16','2026-06-21 19:29:16'),(2,'Cà phê',2,'Cà phê đen đá',NULL,'menu-items/Gre8ofhKg6WbxrUBBSIPC5UpSC958uF38NMDptHT.png',20000.00,NULL,1,'2026-06-21 19:01:25','2026-06-21 20:33:30','2026-06-21 20:33:30'),(3,'Cà phê',2,'Cà phê sữa đá Sài Gòn',NULL,'menu-items/l10BqsX6o1LTa8jzMe9uki8pVsJCKT0BGXttNjEu.png',20000.00,NULL,1,'2026-06-21 19:03:39','2026-06-21 20:33:40','2026-06-21 20:33:40'),(4,'Cà phê',2,'Cà phê đen nóng',NULL,'menu-items/Td4IlRypNlSArgzIkQwirkqIYMF0g1UvEeg94lz6.png',20000.00,NULL,1,'2026-06-21 19:03:39','2026-06-21 20:33:32','2026-06-21 20:33:32'),(5,'Cà phê',2,'Cà phê sữa nóng',NULL,'menu-items/ZPlyXI7LwKEI6WOovVFUnCvMhdSdmTHvWf7pinTV.png',20000.00,NULL,1,'2026-06-21 19:03:39','2026-06-21 20:33:42','2026-06-21 20:33:42'),(6,'Cà phê',2,'Cà phê nguyên chất pha phin',NULL,'menu-items/ZjK6MlEB0jTTF8S3CC2ApvkkCxdhSsf0QZJxWuHC.png',25000.00,NULL,1,'2026-06-21 19:03:39','2026-06-21 20:33:36','2026-06-21 20:33:36'),(7,'Cà phê',2,'Bạc xỉu đá',NULL,'menu-items/VXn679zBut7fCpCh8YdOVYMsra6OVYYXeG2uERZs.png',20000.00,NULL,1,'2026-06-21 19:03:39','2026-06-21 20:33:28','2026-06-21 20:33:28'),(8,'Cà phê',2,'Cà phê muối',NULL,'menu-items/iqzONLVx1hrsKtgmjHeg7sT9nZ35FCpT07PkhtKF.png',25000.00,NULL,1,'2026-06-21 19:03:39','2026-06-21 20:33:34','2026-06-21 20:33:34'),(9,'Cà phê',2,'Milo dầm',NULL,'menu-items/fUK6UKmsTlnw5Kn5QG3ULLvPvZJ74JSp3knBKSRU.png',20000.00,NULL,1,'2026-06-21 19:03:39','2026-06-21 20:33:48','2026-06-21 20:33:48'),(10,'Cà phê',2,'Cacao đá',NULL,'menu-items/JCzfXxr7E451WSw1gBSbNrFxvtdkVnP0sbTPk2pG.png',20000.00,NULL,1,'2026-06-21 19:03:39','2026-06-21 20:33:46','2026-06-21 20:33:46'),(11,'Cà phê',2,'Cà phê pha máy',NULL,'menu-items/qhhUGEuNDh8KbDlxFJ6c1UIqX6QQLpT3Q3P1s1PX.png',25000.00,NULL,1,'2026-06-21 19:03:39','2026-06-21 20:33:38','2026-06-21 20:33:38'),(12,'Món nóng',3,'Trà gừng',NULL,'menu-items/5gwfGxX25IpDntGdRFxGjryvyDV91P6yHJeZRNzO.png',25000.00,NULL,1,'2026-06-21 19:31:03','2026-06-21 20:34:17','2026-06-21 20:34:17'),(13,'Món nóng',3,'Lipton',NULL,'menu-items/sOghOrSOncPSIM6zQr99LWLcafp7gGzPyMiOjL5Z.png',25000.00,NULL,1,'2026-06-21 19:31:03','2026-06-21 20:34:16','2026-06-21 20:34:16'),(14,'Món nóng',3,'Cacao nóng',NULL,'menu-items/1Fw9Tnp2pmN6DHyX4HHZsi7E5C5MLrHYWICFuUBL.png',25000.00,NULL,1,'2026-06-21 19:31:03','2026-06-21 20:34:13','2026-06-21 20:34:13'),(15,'Món nóng',3,'Chanh mật ong',NULL,'menu-items/Wqu7nPXdyDc8OiiCqg5RTKuvGTTKz1X1dJHvxsSX.png',25000.00,NULL,1,'2026-06-21 19:31:03','2026-06-21 20:34:14','2026-06-21 20:34:14'),(16,'Món nóng',3,'Bạc xỉu nóng',NULL,'menu-items/3zeTeF6juWLWg3nB186sbINz4iHG1sl8YhbbK28i.png',20000.00,NULL,1,'2026-06-21 19:31:03','2026-06-21 20:34:11','2026-06-21 20:34:11'),(17,'Trà',4,'Trà đào',NULL,'menu-items/L6kVnYJy3f9QjCqt4OhjvdyH9zPfzCm8Vl87IupJ.png',25000.00,NULL,1,'2026-06-21 19:33:36','2026-06-21 20:35:06','2026-06-21 20:35:06'),(18,'Trà',4,'Trà dưa lưới',NULL,'menu-items/RNQq0HmoD9UI9EuQOsah7NJtOAHFEomYSwg8f3Ku.png',25000.00,NULL,1,'2026-06-21 19:33:36','2026-06-21 20:35:04','2026-06-21 20:35:04'),(19,'Trà',4,'Trà dâu',NULL,'menu-items/0AcHY8y5st7zWSfbpZ09CCNHsnAD3sjUCM9tChf4.png',25000.00,NULL,1,'2026-06-21 19:33:36','2026-06-21 20:35:02','2026-06-21 20:35:02'),(20,'Trà',4,'Trà vải',NULL,'menu-items/v2gRj4wR5MAJGQOgcYXpTFFlBQuuJv8fIEfMVJdK.png',25000.00,NULL,1,'2026-06-21 19:33:36','2026-06-21 20:35:14','2026-06-21 20:35:14'),(21,'Trà',4,'Trà ổi',NULL,'menu-items/X5kit6IIGaxRw77ZoGzVzUiHR93RaCzRh9f9RbFk.png',25000.00,NULL,1,'2026-06-21 19:33:36','2026-06-21 20:35:11','2026-06-21 20:35:11'),(22,'Trà',4,'Trà chanh',NULL,'menu-items/2Zu4XTjVxySOImBqdeMmaKpcO70bdV1HHZV45mVH.png',20000.00,NULL,1,'2026-06-21 19:33:36','2026-06-21 20:35:01','2026-06-21 20:35:01'),(23,'Trà',4,'Trà tắc xí muội',NULL,'menu-items/7XIuSZJzAbqyIj7SJzI4ApUzljjAtrHGTcCGzODz.png',20000.00,NULL,1,'2026-06-21 19:33:36','2026-06-21 20:35:12','2026-06-21 20:35:12'),(24,'Trà',4,'Trà đào cam sả',NULL,'menu-items/LoHrRxhzJ1EPxUJayvNHuRelau0861XYZuCtB3k8.png',30000.00,NULL,1,'2026-06-21 19:33:36','2026-06-21 20:35:07','2026-06-21 20:35:07'),(25,'Trà',4,'Nước sấu',NULL,'menu-items/zEQvHToziGxua0kPUu7GiWjAXRVqxDRV5rD7m5c4.png',25000.00,NULL,1,'2026-06-21 19:33:36','2026-06-21 20:34:58','2026-06-21 20:34:58'),(26,'Nước ngọt',5,'Bò húc',NULL,'menu-items/erCPYeM5yBlW9yTROp9eBRJX7BXo9s2JVql1te64.png',20000.00,NULL,1,'2026-06-21 19:35:50','2026-06-21 20:34:25','2026-06-21 20:34:25'),(27,'Nước ngọt',5,'Sting',NULL,'menu-items/9G8tRqGRcikbHuheAFOViklbAMTX3EEfhCti6W1M.png',15000.00,NULL,1,'2026-06-21 19:35:50','2026-06-21 20:34:33','2026-06-21 20:34:33'),(28,'Nước ngọt',5,'Pepsi',NULL,'menu-items/6PDj5pJHu3pmRigInEd3llnUoDKklWw4IZawgi0w.png',15000.00,NULL,1,'2026-06-21 19:35:50','2026-06-21 20:34:31','2026-06-21 20:34:31'),(29,'Nước ngọt',5,'Trà xanh 0 độ',NULL,'menu-items/3BY8ZWK9OAU5dCqdoltFV6DjsH9OkrqkXpTtK13q.png',15000.00,NULL,1,'2026-06-21 19:35:50','2026-06-21 20:34:36','2026-06-21 20:34:36'),(30,'Nước ngọt',5,'C2',NULL,'menu-items/RgBa6WXYYmM0uGOQ3Z5xYfepxeOWRTvJrdJnWzbO.png',15000.00,NULL,1,'2026-06-21 19:35:50','2026-06-21 20:34:26','2026-06-21 20:34:26'),(31,'Nước ngọt',5,'Number one',NULL,'menu-items/4kWXcq2aWf5rfwjX0RVHoTTB5B3rzTtfxQ4zHbyz.png',15000.00,NULL,1,'2026-06-21 19:35:51','2026-06-21 20:34:28','2026-06-21 20:34:28'),(32,'Nước ngọt',5,'Nước suối',NULL,'menu-items/6LEm5BrbI2UhYQGrKqj3YsBk5pjlta9OqYPj88JB.png',10000.00,NULL,1,'2026-06-21 19:35:51','2026-06-21 20:34:29','2026-06-21 20:34:29'),(33,'Nước ngọt',5,'Sữa Nutri',NULL,'menu-items/PWbobXbAqyq5h1SZhaheGOid2e3gO9UAIemGbIF7.png',15000.00,NULL,1,'2026-06-21 19:35:51','2026-06-21 20:34:34','2026-06-21 20:34:34'),(34,'Matcha latte',6,'Matcha latte',NULL,'menu-items/uAKkdP1KKNd62jIubJVx8XsRWdUBH6dDkxg6XvKi.png',25000.00,NULL,1,'2026-06-21 19:39:33','2026-06-21 20:33:53','2026-06-21 20:33:53'),(35,'Matcha latte',6,'Matcha latte mây hồng',NULL,'menu-items/Q6qrh815ibuKWpPCExTPiqt3LlGWqwprZtZyWLEJ.png',30000.00,NULL,1,'2026-06-21 19:39:33','2026-06-21 20:34:04','2026-06-21 20:34:04'),(36,'Matcha latte',6,'Matcha latte bạc hà',NULL,'menu-items/aiLqeHp5XJpkFuBMEhX3goY6d33LBVjcV6IW2nXn.png',30000.00,NULL,1,'2026-06-21 19:39:33','2026-06-21 20:33:54','2026-06-21 20:33:54'),(37,'Matcha latte',6,'Matcha latte blue',NULL,'menu-items/Y77YpnbGfgCxMMunrfi6jvTzGWwc6uHUVKysx1eH.png',30000.00,NULL,1,'2026-06-21 19:39:33','2026-06-21 20:33:56','2026-06-21 20:33:56'),(38,'Matcha latte',6,'Matcha latte socola',NULL,'menu-items/XxpJlXCXFHTMyX7xc0F74SeLITX49mnKzia5ZolV.png',30000.00,NULL,1,'2026-06-21 19:39:33','2026-06-21 20:34:06','2026-06-21 20:34:06'),(39,'Matcha latte',6,'Matcha latte khoai môn',NULL,'menu-items/tYKXIcZsvUNC7NedVSwHpmtUB1vXNKLDWvrzRnw9.png',30000.00,NULL,1,'2026-06-21 19:39:33','2026-06-21 20:34:01','2026-06-21 20:34:01'),(40,'Matcha latte',6,'Matcha latte việt quất',NULL,'menu-items/MoJzrTi3XymKGjtP988hXYYM0T855cOj8H7nAont.png',30000.00,NULL,1,'2026-06-21 19:39:33','2026-06-21 20:34:08','2026-06-21 20:34:08'),(41,'Matcha latte',6,'Matcha latte xoài',NULL,'menu-items/V36EwexdVgGkVKlc6OGjlH27pQeMQQBEKg1FLtjy.png',30000.00,NULL,1,'2026-06-21 19:39:33','2026-06-21 20:34:09','2026-06-21 20:34:09'),(42,'Matcha latte',6,'Matcha latte đào',NULL,'menu-items/5rNFIfXYMGYvbmQt7g7A8XEX5je2uEVDVmqxX0ZS.png',30000.00,NULL,1,'2026-06-21 19:39:33','2026-06-21 20:33:59','2026-06-21 20:33:59'),(43,'Matcha latte',6,'Matcha latte kiwi',NULL,'menu-items/aarZMCf3y2vcL4ZjN4YXrjZmiVGCS8DH7cM2EeSX.png',30000.00,NULL,1,'2026-06-21 19:39:33','2026-06-21 20:34:02','2026-06-21 20:34:02'),(44,'Matcha latte',6,'Matcha latte dâu',NULL,'menu-items/Ep5qWy5cY6AAIYPdXwH7z6b7sXdIMr53nsuYtB8M.png',30000.00,NULL,1,'2026-06-21 19:39:33','2026-06-21 20:33:58','2026-06-21 20:33:58'),(45,'Matcha latte',6,'Cacao latte',NULL,'menu-items/PA07rsUxvEJsXBEX256YdXHk23D9BQGrVOOptUlC.png',25000.00,NULL,1,'2026-06-21 19:39:33','2026-06-21 20:33:49','2026-06-21 20:33:49'),(46,'Matcha latte',6,'Khoai môn latte',NULL,'menu-items/Fp81iSfPa7eWwmbJedrxs4ykKbuCfMRmk7QNyp5L.png',25000.00,NULL,1,'2026-06-21 19:39:33','2026-06-21 20:33:51','2026-06-21 20:33:51'),(47,'Sữa chua',7,'Sữa chua mix việt quất',NULL,'menu-items/fbtumVRNZLQnBW04arxGHRv1eFjo2UW0SK5uh7FR.png',25000.00,NULL,1,'2026-06-21 19:41:12','2026-06-21 20:34:54','2026-06-21 20:34:54'),(48,'Sữa chua',7,'Sữa chua mix xoài',NULL,'menu-items/jEAYM11icyi0OKmON1VOWT5Ki2YsEQXiYLBuXmmN.png',25000.00,NULL,1,'2026-06-21 19:41:12','2026-06-21 20:34:56','2026-06-21 20:34:56'),(49,'Sữa chua',7,'Sữa chua mix dâu',NULL,'menu-items/hQ9taRVzvK438zxIXIYiWEveaxSjoj54f2V9SfJX.png',25000.00,NULL,1,'2026-06-21 19:41:12','2026-06-21 20:34:51','2026-06-21 20:34:51'),(50,'Sữa chua',7,'Sữa chua mix kiwi',NULL,'menu-items/dLwwTPyBizGLAJxJEQ8LmjFjEogsForGHssmtewS.png',25000.00,NULL,1,'2026-06-21 19:41:12','2026-06-21 20:34:53','2026-06-21 20:34:53'),(51,'Sữa chua',7,'Sữa chua hạt đác',NULL,'menu-items/fL1B8jWPM20iUQWf9oI2Tr0LQQ4KVcL6MxSnjSi3.png',30000.00,NULL,1,'2026-06-21 19:41:12','2026-06-21 20:34:50','2026-06-21 20:34:50'),(52,'Soda',8,'Soda việt quất',NULL,'menu-items/5zWzjDZ5FItnWrpjFGkwFXpCYHsAylUEdoNsLmG3.png',20000.00,NULL,1,'2026-06-21 19:42:21','2026-06-21 20:34:48','2026-06-21 20:34:48'),(53,'Soda',8,'Soda bạc hà',NULL,'menu-items/55Xei26FquzazIjCPJNdZIot0jGb6VdNcFFmGJcf.png',20000.00,NULL,1,'2026-06-21 19:42:21','2026-06-21 20:34:44','2026-06-21 20:34:44'),(54,'Soda',8,'Soda blue',NULL,'menu-items/Wx1Mv32O2Cwt5AbSNiyvhKWUynB6E1IJ6dbNu6CP.png',20000.00,NULL,1,'2026-06-21 19:42:21','2026-06-21 20:34:45','2026-06-21 20:34:45'),(55,'Soda',8,'Soda dâu',NULL,'menu-items/PeSmfKhOLLrvUX35ZiPXMHh2AIJIAsMbEIjUYUrf.png',20000.00,NULL,1,'2026-06-21 19:42:21','2026-06-21 20:34:47','2026-06-21 20:34:47'),(56,'Trà sữa',9,'Trà sữa truyền thống',NULL,'menu-items/0ygdU4yt7Gv2bOJbJntrKbDU7A9zLUhpsxoPieDo.png',25000.00,NULL,1,'2026-06-21 19:43:05','2026-06-21 20:35:18','2026-06-21 20:35:18'),(57,'Trà sữa',9,'Trà sữa khoai môn',NULL,'menu-items/Pqgc2rfBYByAbVw9UFTQaIxZ7rgL0NEI1Tqa7xfJ.png',25000.00,NULL,1,'2026-06-21 19:43:05','2026-06-21 20:35:16','2026-06-21 20:35:16'),(58,'Siro',10,'Siro socola',NULL,'menu-items/b0yijIr9EuklllNL3xejPKyEP7hKD3T4T73HWnvA.png',20000.00,NULL,1,'2026-06-21 19:45:32','2026-06-21 20:34:42','2026-06-21 20:34:42'),(59,'Siro',10,'Siro bạc hà',NULL,'menu-items/mCTK4KwAD44rc2I9JoqvDwipF8TBlOoUdoRfzHf6.png',20000.00,NULL,1,'2026-06-21 19:45:32','2026-06-21 20:34:38','2026-06-21 20:34:38'),(60,'Siro',10,'Siro dâu',NULL,'menu-items/ZQBtzWzmyg3givSW6DDlzU3LpDiuBWHWRiOjoT2m.png',20000.00,NULL,1,'2026-06-21 19:45:32','2026-06-21 20:34:41','2026-06-21 20:34:41'),(61,'Siro',10,'Siro blue',NULL,'menu-items/tf7Sa6BUKsF34v85LT0guZUOTqqaIQopMG1g9hFa.png',20000.00,NULL,1,'2026-06-21 19:45:32','2026-06-21 20:34:39','2026-06-21 20:34:39'),(62,'Nước ép',11,'Ép cam',NULL,'menu-items/WuXZEA7hw8nZCc34kW8BZCyGbOzb1MlzRIAEUxcY.png',20000.00,NULL,1,'2026-06-21 19:46:56','2026-06-21 20:34:18','2026-06-21 20:34:18'),(63,'Nước ép',11,'Ép cam chanh leo',NULL,'menu-items/DEadpboUZonutL9MUZBo0QzgiBGK9h3teIw4tKuV.png',25000.00,NULL,1,'2026-06-21 19:46:56','2026-06-21 20:34:20','2026-06-21 20:34:20'),(64,'Nước ép',11,'Ép táo thơm',NULL,'menu-items/w8yY8Jn9u0Rz6LzptGX97D1Rylrk9WHFy88UXnnq.png',25000.00,NULL,1,'2026-06-21 19:46:56','2026-06-21 20:34:23','2026-06-21 20:34:23'),(65,'Nước ép',11,'Ép ổi',NULL,'menu-items/M2b2Vs48iwpuhDpfHfykzNjF4OjceYGBcrghsH1K.png',25000.00,NULL,1,'2026-06-21 19:46:56','2026-06-21 20:34:22','2026-06-21 20:34:22'),(66,'Ăn vặt',12,'Viên chiên',NULL,'menu-items/J1aVKzyt8KiMSWzmg558oiSr27rHen21aGkJmhgC.png',0.00,'30000-50000',1,'2026-06-21 20:01:58','2026-06-21 20:33:19','2026-06-21 20:33:19'),(67,'Ăn vặt',12,'Khoai tây chiên',NULL,'menu-items/zuDeQBPHLVt21ovSb4rQQSF7BMg1BCcjbc4nIOD7.png',0.00,'30000-50000',1,'2026-06-21 20:01:58','2026-06-21 20:33:14','2026-06-21 20:33:14'),(68,'Ăn vặt',12,'Đùi gà chiên',NULL,'menu-items/otYU9R5yiKaoT6BMjKS1YQ60kIRdvgRIFRfVh6xN.png',25000.00,NULL,1,'2026-06-21 20:01:58','2026-06-21 20:33:04','2026-06-21 20:33:04'),(69,'Ăn vặt',12,'Xúc xích chiên (2 cái)',NULL,'menu-items/bjocxtwJSs5Qml90SrW9ul7twmtfSCQO5DBD7C1o.png',15000.00,NULL,1,'2026-06-21 20:01:58','2026-06-21 20:33:20','2026-06-21 20:33:20'),(70,'Ăn vặt',12,'Mì xúc xích',NULL,'menu-items/Its3uWdy7p2Pxsj8fzP1zkNcj0UfbonGYXoBntLQ.png',20000.00,NULL,1,'2026-06-21 20:01:58','2026-06-21 20:33:17','2026-06-21 20:33:17'),(71,'Ăn vặt',12,'Mì trứng',NULL,'menu-items/WZ57oSnnsNy18HPpOe8vghHtxq36fjYON00YYbCU.png',20000.00,NULL,1,'2026-06-21 20:01:58','2026-06-21 20:33:15','2026-06-21 20:33:15'),(72,'View',1,'View ăn uống',NULL,NULL,50000.00,NULL,1,'2026-06-21 20:02:49','2026-06-21 20:35:19','2026-06-21 20:35:19'),(73,'Cà phê',2,'Cà phê đen đá',NULL,'menu-items/MnvZftShWwQcpIM32hWhuVYdWRULO0knukAkuZmE.png',20000.00,NULL,1,'2026-06-21 20:35:55','2026-06-21 20:36:02','2026-06-21 20:36:02'),(74,'Cà phê',2,'Cà phê đen đá',NULL,'menu-items/gbNWa8V2tfUpnrU79SLbjHtJANsFoMBmpo1oZYOA.png',20000.00,NULL,1,'2026-06-21 21:49:02','2026-06-21 21:49:02',NULL),(75,'Cà phê',2,'Cà phê sữa đá Sài Gòn',NULL,'menu-items/z6yzeKaiIIPMZI70IPV8gSRlWENmE5XsnxS4eake.png',20000.00,NULL,1,'2026-06-21 21:49:02','2026-06-21 21:49:02',NULL),(76,'Cà phê',2,'Cà phê đen nóng',NULL,'menu-items/GF96ODro6anBQ0zzllkioo0JpmhrH6xp8Aj5Vypw.png',20000.00,NULL,1,'2026-06-21 21:49:02','2026-06-21 21:49:02',NULL),(77,'Cà phê',2,'Cà phê sữa nóng',NULL,'menu-items/mpKtfjp7GBUkICgMZbdiqeftI6bXmWyyWQhT71Jy.png',20000.00,NULL,1,'2026-06-21 21:49:02','2026-06-21 21:49:02',NULL),(78,'Cà phê',2,'Cà phê nguyên chất pha phin',NULL,'menu-items/H8aG6lX4GfwyAoqY2dSraZvyDyiOQI7fp5LWtGOP.png',25000.00,NULL,1,'2026-06-21 21:49:02','2026-06-21 21:49:02',NULL),(79,'Cà phê',2,'Bạc xỉu đá',NULL,'menu-items/HTjliVqVGzxuI3mOG5dtpdzDUqIeSrKEkQDIDAGq.png',20000.00,NULL,1,'2026-06-21 21:49:02','2026-06-21 21:49:02',NULL),(80,'Cà phê',2,'Cà phê muối',NULL,'menu-items/I3FHsTtoNC1k71D7biaCMBAilPZf2h2adQQo6N02.png',25000.00,NULL,1,'2026-06-21 21:49:02','2026-06-21 21:49:02',NULL),(81,'Cà phê',2,'Milo dầm',NULL,'menu-items/2poAfjO0Kj7a1Eo3hkVfuagjt5xANlaPdT5Bisnu.png',20000.00,NULL,1,'2026-06-21 21:49:02','2026-06-21 21:49:02',NULL),(82,'Cà phê',2,'Cacao đá',NULL,'menu-items/Y2vUgpmr4xFK5Gz4Tr1tgZgdUzAjnk7l7TBAibsM.png',25000.00,NULL,1,'2026-06-21 21:49:02','2026-06-21 21:49:02',NULL),(83,'Cà phê',2,'Cà phê pha máy',NULL,'menu-items/Z7W7VKIdIMdYKnRcTYIxeZio1JrbtUnzaRCE5xkO.png',25000.00,NULL,1,'2026-06-21 21:49:02','2026-06-21 21:49:02',NULL),(84,'Món nóng',3,'Trà gừng',NULL,'menu-items/ebVpV7edIEQ7vjtsNqKj964xeisQ8SGvhxpUDZLN.png',25000.00,NULL,1,'2026-06-21 21:50:18','2026-06-21 21:50:18',NULL),(85,'Món nóng',3,'Lipton',NULL,'menu-items/7NMYWRMDHZMLgnD8WITAnQREmjiaH6tQKQYIa2qe.png',25000.00,NULL,1,'2026-06-21 21:50:18','2026-06-21 21:50:18',NULL),(86,'Món nóng',3,'Cacao nóng',NULL,'menu-items/yzY9vqPnMkH9RtZCiu19aSOlyEKQfpqScTgjUckZ.png',25000.00,NULL,1,'2026-06-21 21:50:18','2026-06-21 21:50:18',NULL),(87,'Món nóng',3,'Chanh mật ong',NULL,'menu-items/geDViBFkJjtqVTfrPVZGZVEu2wbthaRxOF2vCK9s.png',25000.00,NULL,1,'2026-06-21 21:50:18','2026-06-21 21:50:18',NULL),(88,'Món nóng',3,'Bạc xỉu nóng',NULL,'menu-items/zyeTnhnm50cm1uV8Yc5wkmwuXMLbeSzMHknBlXmq.png',20000.00,NULL,1,'2026-06-21 21:50:18','2026-06-21 21:50:18',NULL),(89,'Trà',4,'Trà đào',NULL,'menu-items/KdSjhUkK0iflu0VTTp8DEgA3Q0u85gUMYWU2pP5w.png',25000.00,NULL,1,'2026-06-21 22:15:09','2026-06-21 22:15:09',NULL),(90,'Trà',4,'Trà dưa lưới',NULL,'menu-items/Ma0QKN8CHErSyZmmUrKj5YEJRxzl6buBg5m7U8PP.png',25000.00,NULL,1,'2026-06-21 22:15:09','2026-06-21 22:15:09',NULL),(91,'Trà',4,'Trà dâu',NULL,'menu-items/rB5yaBXGsIFr3r2NNM3VUsO7UTN1SzByCU3ywD9Y.png',25000.00,NULL,1,'2026-06-21 22:15:09','2026-06-21 22:15:09',NULL),(92,'Trà',4,'Trà vải',NULL,'menu-items/KTrEPzVF3M2xhXnEMghvXSHlXSRxnWACuBXS4z9R.png',25000.00,NULL,1,'2026-06-21 22:15:09','2026-06-21 22:15:09',NULL),(93,'Trà',4,'Trà ổi',NULL,'menu-items/SA0Ktxmv6RwlTzAkTcwbqsIic9X11QbHkotziuaN.png',25000.00,NULL,1,'2026-06-21 22:15:09','2026-06-21 22:15:09',NULL),(94,'Trà',4,'Trà chanh',NULL,'menu-items/IXv9LNrFkt3j8b2wyGEWIxxyau0HtUp3QzRrsOs3.png',20000.00,NULL,1,'2026-06-21 22:15:09','2026-06-21 22:15:09',NULL),(95,'Trà',4,'Trà tắc xí muội',NULL,'menu-items/ljqtEaDmAjW1Nhx83sji9V38vvdQQG1kMcKxBw1M.png',20000.00,NULL,1,'2026-06-21 22:15:09','2026-06-21 22:15:09',NULL),(96,'Trà',4,'Trà đào cam sả',NULL,'menu-items/RWTjxoB5dk5TxRX2S9WTS50JwxzjWCC8dksf37M0.png',30000.00,NULL,1,'2026-06-21 22:15:09','2026-06-21 22:15:09',NULL),(97,'Trà',4,'Nước sấu',NULL,'menu-items/gnVXcZ5sTIijqUSsBl01499gMRlnvGIMnzrISDUn.png',25000.00,NULL,1,'2026-06-21 22:15:09','2026-06-21 22:15:09',NULL),(98,'Nước ngọt',5,'Bò húc',NULL,'menu-items/9g0CmN3iBQjEg27RQvrjFSevgJVPf7SPGzqHxX1A.png',20000.00,NULL,1,'2026-06-21 22:17:17','2026-06-21 22:17:17',NULL),(99,'Nước ngọt',5,'Sting',NULL,'menu-items/VjPUviSLCFJfErPgj1EXgpwRNDjXOzl49condzsj.png',15000.00,NULL,1,'2026-06-21 22:17:17','2026-06-21 22:17:17',NULL),(100,'Nước ngọt',5,'Pepsi',NULL,'menu-items/ofoVKRaBROxcVkgyIVbkc6GymCGvguZogO3eOFQv.png',15000.00,NULL,1,'2026-06-21 22:17:17','2026-06-21 22:17:17',NULL),(101,'Nước ngọt',5,'Trà xanh 0 độ',NULL,'menu-items/xh8InUpuhyEOeRWQ63G7FfKcRs8NNGLv5dJYzQcv.png',15000.00,NULL,1,'2026-06-21 22:17:17','2026-06-21 22:17:17',NULL),(102,'Nước ngọt',5,'C2',NULL,'menu-items/9toOCFOztQyztvJoUkoXmPCrYKAionsqOlV7ASnp.png',15000.00,NULL,1,'2026-06-21 22:17:17','2026-06-21 22:17:17',NULL),(103,'Nước ngọt',5,'Number one',NULL,'menu-items/WyrDRYHQVliabeTUDfwiUHVxzqeQhS9Wg2sW8q4A.png',15000.00,NULL,1,'2026-06-21 22:17:17','2026-06-21 22:17:17',NULL),(104,'Nước ngọt',5,'Nước suối',NULL,'menu-items/4GsrsQpUWm4OKEFML5PvXXqvpP063imVsZRo0GPg.png',10000.00,NULL,1,'2026-06-21 22:17:17','2026-06-21 22:17:17',NULL),(105,'Nước ngọt',5,'Sữa Nutri',NULL,'menu-items/XJZXKvim2F2WURSXRVqHXNjeVqh68yNx5kuWwErC.png',15000.00,NULL,1,'2026-06-21 22:17:17','2026-06-21 22:17:17',NULL),(106,'Matcha latte',6,'Matcha latte',NULL,'menu-items/8PM6aJphydSyo9cq2pfs2KBgjIL4ZDCl4EdrH8SW.png',25000.00,NULL,1,'2026-06-21 22:20:19','2026-06-21 22:20:19',NULL),(107,'Matcha latte',6,'Matcha latte mây hồng',NULL,'menu-items/mzs0NAF2HMFfNBbtpk4XCRsvVQ1qAdZueDw0dN1k.png',30000.00,NULL,1,'2026-06-21 22:20:19','2026-06-21 22:20:19',NULL),(108,'Matcha latte',6,'Matcha latte bạc hà',NULL,'menu-items/WYhj6b90g5A3nOyDtoNackjfu8YhPK5VUVGwXXMH.png',30000.00,NULL,1,'2026-06-21 22:20:19','2026-06-21 22:20:19',NULL),(109,'Matcha latte',6,'Matcha latte blue',NULL,'menu-items/2YjZbvjFSehSOnSnbC6hAq9BlvpiDOVQ6NdJyQH4.png',30000.00,NULL,1,'2026-06-21 22:20:19','2026-06-21 22:20:19',NULL),(110,'Matcha latte',6,'Matcha latte socola',NULL,'menu-items/RurXB0X4P9JbdnUxHqeTXXnlia8CNpYUvKe1e0Qt.png',30000.00,NULL,1,'2026-06-21 22:20:19','2026-06-21 22:20:19',NULL),(111,'Matcha latte',6,'Matcha latte khoai môn',NULL,'menu-items/4sOzF6J4mGR39jt4IiUPG5VxZrDdqMYn3qBOI1Vl.png',30000.00,NULL,1,'2026-06-21 22:20:19','2026-06-21 22:20:19',NULL),(112,'Matcha latte',6,'Matcha latte việt quất',NULL,'menu-items/hYx6O6jipv7JtRk1xfmsXzKLn38dpEqQlo5QRvl2.png',30000.00,NULL,1,'2026-06-21 22:20:19','2026-06-21 22:20:19',NULL),(113,'Matcha latte',6,'Matcha latte xoài',NULL,'menu-items/mySVmG3N73tHUnpJULfZS79rx4VoxMafodg0gb3H.png',30000.00,NULL,1,'2026-06-21 22:20:19','2026-06-21 22:20:19',NULL),(114,'Matcha latte',6,'Matcha latte đào',NULL,'menu-items/k7uy1GqrBJa8A2KMbVsikKKie56a9wFP8nA4jsVv.png',30000.00,NULL,1,'2026-06-21 22:20:19','2026-06-21 22:20:19',NULL),(115,'Matcha latte',6,'Matcha latte kiwi',NULL,'menu-items/RKF0AZZ4OJ7jNWkLVRTkR8KF4r0LNCokvFEsL7AI.png',30000.00,NULL,1,'2026-06-21 22:20:19','2026-06-21 22:20:19',NULL),(116,'Matcha latte',6,'Matcha latte dâu',NULL,'menu-items/uUhMQF30B3y6rI4MV1MjNaCFMvBcMF1SIVIIORL6.png',30000.00,NULL,1,'2026-06-21 22:20:19','2026-06-21 22:20:19',NULL),(117,'Matcha latte',6,'Cacao latte',NULL,'menu-items/Dnwba1ZPlkaOOdnBxseJcUF0DKYjlWWx3I2BRjKt.png',25000.00,NULL,1,'2026-06-21 22:20:19','2026-06-21 22:20:19',NULL),(118,'Matcha latte',6,'Khoai môn latte',NULL,'menu-items/Qk94Q7FFDYXxsVwTCSLsR1by7o44PLYeI3xzNiKQ.png',25000.00,NULL,1,'2026-06-21 22:20:19','2026-06-21 22:20:19',NULL),(119,'Sữa chua',7,'Sữa chua mix việt quất',NULL,'menu-items/0TVlJs2YszYiLkBuxf9vn58X3bU6HCm279lhuUUR.png',25000.00,NULL,1,'2026-06-21 22:21:38','2026-06-21 22:21:38',NULL),(120,'Sữa chua',7,'Sữa chua mix xoài',NULL,'menu-items/rEVNTY5gt8n9adQRreuyWy8UqA0GooUmrCuKwTIR.png',25000.00,NULL,1,'2026-06-21 22:21:38','2026-06-21 22:21:38',NULL),(121,'Sữa chua',7,'Sữa chua mix dâu',NULL,'menu-items/UkmAGHbv2166e86RMRH7kyCnQfbBAkaCUZkSQjbD.png',25000.00,NULL,1,'2026-06-21 22:21:38','2026-06-21 22:21:38',NULL),(122,'Sữa chua',7,'Sữa chua mix kiwi',NULL,'menu-items/CstBo4Zkj1nLMUakDjiyFx8ETX0VauF2vR1FpYWr.png',25000.00,NULL,1,'2026-06-21 22:21:38','2026-06-21 22:21:38',NULL),(123,'Sữa chua',7,'Sữa chua hạt đác',NULL,'menu-items/VpWyoWvz1bx8fPDYpQIt8B3QvRbfNbvpoQIdaIBR.png',30000.00,NULL,1,'2026-06-21 22:21:38','2026-06-21 22:21:38',NULL),(124,'Soda',8,'Soda việt quất',NULL,'menu-items/rVX2LVHRxBHIeGwL9M1XfcaBEZfFrf4LAnAoZYZV.png',20000.00,NULL,1,'2026-06-21 22:22:30','2026-06-21 22:22:30',NULL),(125,'Soda',8,'Soda bạc hà',NULL,'menu-items/mDvTyYcL580zdql5fgxbKEDpnD6RMEnlH9hiNUAj.png',20000.00,NULL,1,'2026-06-21 22:22:30','2026-06-21 22:22:30',NULL),(126,'Soda',8,'Soda blue',NULL,'menu-items/X7ctE8X0j5deraMOvjwhVJhtQkSuT8kd9dXvKmD8.png',20000.00,NULL,1,'2026-06-21 22:22:30','2026-06-21 22:22:30',NULL),(127,'Soda',8,'Soda dâu',NULL,'menu-items/TnuP1Ptqk6r9k6vtvG0lSBHh7Z4oWKgdcWtNHyB7.png',20000.00,NULL,1,'2026-06-21 22:22:30','2026-06-21 22:22:30',NULL),(128,'Trà sữa',9,'Trà sữa truyền thống',NULL,'menu-items/EcN8VwDr7BE2r5A2tQpmmv2LKJepcTJOlREiNQBA.png',25000.00,NULL,1,'2026-06-21 22:23:00','2026-06-21 22:23:00',NULL),(129,'Trà sữa',9,'Trà sữa khoai môn',NULL,'menu-items/NKrs1zi4DxJNRYyyziLApPFNAP6pZGqu0xyEsmdD.png',25000.00,NULL,1,'2026-06-21 22:23:00','2026-06-21 22:23:00',NULL),(130,'Siro',10,'Siro socola',NULL,'menu-items/24Tk5OxX0jJvtfVstWkDAeI559xMVKwf6WNX50Yz.png',20000.00,NULL,1,'2026-06-21 22:23:50','2026-06-21 22:23:50',NULL),(131,'Siro',10,'Siro bạc hà',NULL,'menu-items/JUqmnc3Emmc99aSj92TuH21wrMLRVUpzwR7OKRy4.png',20000.00,NULL,1,'2026-06-21 22:23:50','2026-06-21 22:23:50',NULL),(132,'Siro',10,'Siro dâu',NULL,'menu-items/mLfN7csro0lpvpGiTCsfoEqe5utQTMjGMQcxj8hL.png',20000.00,NULL,1,'2026-06-21 22:23:50','2026-06-21 22:23:50',NULL),(133,'Siro',10,'Siro blue',NULL,'menu-items/Dq9YGnB16cpIYZx7xaoDOz9YpdM1NWnxNCR4b6g1.png',20000.00,NULL,1,'2026-06-21 22:23:50','2026-06-21 22:23:50',NULL),(134,'Nước ép',11,'Ép cam',NULL,'menu-items/fK8JhWKDuopUeHDwInQpH6thOCos3DuhZwWUqFSU.png',20000.00,NULL,1,'2026-06-21 22:25:15','2026-06-21 22:25:15',NULL),(135,'Nước ép',11,'Ép cam chanh leo',NULL,'menu-items/Xx0cIANbaPZf2s3BBCQJ5SmDaczNMHrx6AFj1o52.png',25000.00,NULL,1,'2026-06-21 22:25:15','2026-06-21 22:25:15',NULL),(136,'Nước ép',11,'Ép cà rốt',NULL,'menu-items/TVOVyqiTtHlzZ205rziB4mTvs0SbbPxBTeCUaPUY.png',20000.00,NULL,1,'2026-06-21 22:25:15','2026-06-21 22:25:15',NULL),(137,'Nước ép',11,'Ép táo thơm',NULL,'menu-items/Tu5jdaTB88gAV6YI8F1hwWmd9FsF9r8TmOtj1R9N.png',25000.00,NULL,1,'2026-06-21 22:25:15','2026-06-21 22:25:15',NULL),(138,'Nước ép',11,'Ép ổi',NULL,'menu-items/13HSAXVPheIe6EwbGz0bJCTcCkNZi7weLtlcB5Yi.png',25000.00,NULL,1,'2026-06-21 22:25:15','2026-06-21 22:25:15',NULL),(139,'Ăn vặt',12,'Viên chiên',NULL,'menu-items/53Xp8CPJQmHe8RMqccRQN8dCCW1WFtzkjkgbaRrM.png',0.00,'30000-50000',1,'2026-06-21 22:26:46','2026-06-21 22:26:46',NULL),(140,'Ăn vặt',12,'Khoai tây chiên',NULL,'menu-items/RZDoOVShLpkUtOLUcQjJol7FRzZlkR4FES6kQags.png',0.00,'30000-50000',1,'2026-06-21 22:26:46','2026-06-21 22:26:46',NULL),(141,'Ăn vặt',12,'Đùi gà chiên',NULL,'menu-items/8UthosNmrMazYBF23a0o62zoRlyfK64DVqjOHhk1.png',25000.00,NULL,1,'2026-06-21 22:26:46','2026-06-21 22:26:46',NULL),(142,'Ăn vặt',12,'Xúc xích chiên (2 cái)',NULL,'menu-items/FEQplqFjhAPZ5R2MrlwdDXhcswQoD8GOvRe48BaM.png',15000.00,NULL,1,'2026-06-21 22:26:46','2026-06-21 22:26:46',NULL),(143,'Ăn vặt',12,'Mỳ xúc xích',NULL,'menu-items/nkURrgU8868QpOzoVJUH83Sa6QAmPz5dR22Xt9uZ.png',20000.00,NULL,1,'2026-06-21 22:26:46','2026-06-21 22:26:46',NULL),(144,'Ăn vặt',12,'Mì trứng',NULL,'menu-items/2PsOmGHBe6hhj5XlfgzH6m0xUc6qVR7Fdi75f8Mk.png',20000.00,NULL,1,'2026-06-21 22:26:46','2026-06-21 22:26:46',NULL);
/*!40000 ALTER TABLE `menu_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0001_01_01_000000_create_users_table',1),(2,'0001_01_01_000001_create_cache_table',1),(3,'0001_01_01_000002_create_jobs_table',1),(4,'2026_06_20_000100_create_pos_tables',1),(5,'2026_06_20_000200_add_image_path_to_menu_items_table',2),(6,'2026_06_21_004230_add_note_to_order_items_table',3),(7,'2026_06_22_000100_create_menu_categories_table',4),(8,'2026_06_22_025224_add_display_price_to_menu_items_table',5);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notifiable_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notifiable_id` bigint unsigned NOT NULL,
  `data` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_notifiable_type_notifiable_id_index` (`notifiable_type`,`notifiable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `menu_item_id` bigint unsigned DEFAULT NULL,
  `line_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'menu',
  `name_snapshot` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unit_price` decimal(14,2) NOT NULL,
  `quantity` int unsigned NOT NULL,
  `paid_quantity` int unsigned NOT NULL DEFAULT '0',
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `order_items_order_id_foreign` (`order_id`),
  KEY `order_items_menu_item_id_foreign` (`menu_item_id`),
  CONSTRAINT `order_items_menu_item_id_foreign` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `order_items_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_number` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `coffee_table_id` bigint unsigned DEFAULT NULL,
  `fishing_spot_id` bigint unsigned DEFAULT NULL,
  `opened_by` bigint unsigned NOT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `subtotal` decimal(14,2) NOT NULL DEFAULT '0.00',
  `total` decimal(14,2) NOT NULL DEFAULT '0.00',
  `version` int unsigned NOT NULL DEFAULT '1',
  `completed_at` timestamp NULL DEFAULT NULL,
  `voided_at` timestamp NULL DEFAULT NULL,
  `void_reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `orders_order_number_unique` (`order_number`),
  KEY `orders_coffee_table_id_foreign` (`coffee_table_id`),
  KEY `orders_fishing_spot_id_foreign` (`fishing_spot_id`),
  KEY `orders_opened_by_foreign` (`opened_by`),
  KEY `orders_service_type_status_index` (`service_type`,`status`),
  KEY `orders_service_type_index` (`service_type`),
  KEY `orders_status_index` (`status`),
  KEY `orders_completed_at_index` (`completed_at`),
  CONSTRAINT `orders_coffee_table_id_foreign` FOREIGN KEY (`coffee_table_id`) REFERENCES `coffee_tables` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `orders_fishing_spot_id_foreign` FOREIGN KEY (`fishing_spot_id`) REFERENCES `fishing_spots` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `orders_opened_by_foreign` FOREIGN KEY (`opened_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `otp_challenges`
--

DROP TABLE IF EXISTS `otp_challenges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `otp_challenges` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `code_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` tinyint unsigned NOT NULL DEFAULT '0',
  `expires_at` timestamp NOT NULL,
  `used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `otp_challenges_user_id_created_at_index` (`user_id`,`created_at`),
  CONSTRAINT `otp_challenges_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `otp_challenges`
--

LOCK TABLES `otp_challenges` WRITE;
/*!40000 ALTER TABLE `otp_challenges` DISABLE KEYS */;
INSERT INTO `otp_challenges` VALUES (1,2,'$2y$12$IpuarFyXNNDjVPnL7o5BxuAXXUQkuX0sKXHVtUlYrtIlCt1FNcSzC',0,'2026-06-20 10:32:06',NULL,'2026-06-20 10:22:06','2026-06-20 10:22:06'),(2,2,'$2y$12$UdMJJeEPza2PwfAMvD64OOi5OhCVntUxzmIXQRA8s.dXPOU8E8Lha',0,'2026-06-20 10:35:37',NULL,'2026-06-20 10:25:37','2026-06-20 10:25:37'),(3,2,'$2y$12$oSqxY7l5udEKj1oqAGuf4eDil6hjlScCVjBE4RBgxS71Y4NQz3gKW',0,'2026-06-20 10:38:18','2026-06-20 10:28:45','2026-06-20 10:28:18','2026-06-20 10:28:45'),(4,2,'$2y$12$dWKP/INHab8E6eCAb9BRMOGrqnAftHEAN5sNSviEP8s43YCX3IaAq',0,'2026-06-20 10:44:26','2026-06-20 10:34:42','2026-06-20 10:34:26','2026-06-20 10:34:42'),(5,2,'$2y$12$SbM3n1rrMv1T1Vp0SrG5O.fAkaEcKSumgwQyu8bsIbUV90Vu6/z1i',0,'2026-06-20 10:46:50','2026-06-20 10:37:19','2026-06-20 10:36:50','2026-06-20 10:37:19'),(6,2,'$2y$12$WsX5mrbuEsiY6vohLM3FgOdpvauJPLlESg70WbIzF7mEDyzAdxVsi',0,'2026-06-20 10:50:36','2026-06-20 10:41:04','2026-06-20 10:40:36','2026-06-20 10:41:04'),(7,2,'$2y$12$2SzxNSAFwY.FoJo78XEwDeGnItAxGvxenprDv.NjI1y9pjLM0oCAu',0,'2026-06-20 11:08:55','2026-06-20 10:59:15','2026-06-20 10:58:55','2026-06-20 10:59:15'),(8,2,'$2y$12$mwEfQ9Oj83tGn4vW9VcnTOVWPj/nwM0MyUrCaDTqYINT.wbvEBmNe',0,'2026-06-20 13:19:08','2026-06-20 13:09:46','2026-06-20 13:09:08','2026-06-20 13:09:46'),(9,2,'$2y$12$ZSo4mHSuk1NvEyLc90PYV.rzwhKQGJXOg0InzUAVfHtDJsn.pRvIu',0,'2026-06-20 16:26:05',NULL,'2026-06-20 16:16:05','2026-06-20 16:16:05'),(10,2,'$2y$12$LxssglG6.DG8luI9OylSHOh6FvgmrUL1r1hu46x24V0KasbkTLInO',0,'2026-06-20 16:27:17',NULL,'2026-06-20 16:17:17','2026-06-20 16:17:17'),(11,2,'$2y$12$OSoJ.1NwoXWCzDmPFvvoj.p4ny8JYMDw8ifnZiuw2d.fSymGvNX2G',1,'2026-06-20 16:32:28',NULL,'2026-06-20 16:22:28','2026-06-20 16:22:48'),(12,2,'$2y$12$5.VYrhjrG75Br.me2ahHP.cLnF6XmCaka7cQtlH9urugYdrRkkkUG',0,'2026-06-20 16:41:01',NULL,'2026-06-20 16:31:01','2026-06-20 16:31:01'),(13,2,'$2y$12$llciEuEUu.FN0XZBu.RT5eZMbSxgtCfjODnao88xRHClSZc0h0EcW',0,'2026-06-20 16:42:02',NULL,'2026-06-20 16:32:02','2026-06-20 16:32:02'),(14,2,'$2y$12$W54ZJL0H5aOExtcf5eUCjucM1JPpjbDpBf5XmOzWqJtvu4Q6gWlqi',0,'2026-06-20 16:44:47','2026-06-20 16:35:54','2026-06-20 16:34:47','2026-06-20 16:35:54'),(15,2,'$2y$12$bPfO6F4pC8UpLaSHTM8Lv.R7zlJiYXFmJsQSqBhxfGso.mNM.0dba',0,'2026-06-20 18:37:45','2026-06-20 18:28:01','2026-06-20 18:27:45','2026-06-20 18:28:01'),(16,2,'$2y$12$4lOca/v27HBMZfLv/E88zeokAo/EodDle8UgdXH.vW3MFcNLS4Nly',4,'2026-06-21 05:44:21','2026-06-21 05:34:58','2026-06-21 05:34:21','2026-06-21 05:34:58'),(17,2,'$2y$12$9nyQWpRQUHH9k5z666KDI.9eRfHBBEiQ2q16tzMVL/aJQ2VAcH8Da',0,'2026-06-21 06:15:15','2026-06-21 06:05:41','2026-06-21 06:05:15','2026-06-21 06:05:41'),(18,2,'$2y$12$yEMGQGh32vf6NdclMlZlde/.0GgYAB3Ir3gn.sIzRdaPZC7/fMX/i',0,'2026-06-21 07:16:59','2026-06-21 07:07:42','2026-06-21 07:06:59','2026-06-21 07:07:42'),(19,2,'$2y$12$vZd13iuWzc6/NIedHqvSyORvF86xxV2FkxC1SWb1kQ5WeMb/kgHY.',0,'2026-06-21 12:05:27','2026-06-21 11:55:44','2026-06-21 11:55:27','2026-06-21 11:55:44'),(20,2,'$2y$12$mLAqeVlbxjJ7RE/Yg1qaUeSJdNUPCIlQdsAhXakrWLIrCCQpV9bjK',2,'2026-06-21 12:26:38','2026-06-21 12:17:32','2026-06-21 12:16:38','2026-06-21 12:17:32'),(21,2,'$2y$12$O1Emdz4cpCmpbWjYOzpjJeb2MIPVnFelAq5.mjghaBCZYSkF9IXp2',0,'2026-06-21 12:39:10','2026-06-21 12:29:33','2026-06-21 12:29:10','2026-06-21 12:29:33'),(22,2,'$2y$12$Ik4VnBES0V2VAif8R/jWU.1FR6bSLpxbbIz3Q7N4Cn0qgJDGH34oS',0,'2026-06-21 13:34:59','2026-06-21 13:25:49','2026-06-21 13:24:59','2026-06-21 13:25:49'),(23,2,'$2y$12$K6x2veFuxMTWEejP8wsRN.3Ug1O9EKpILcIz07IIm1B/FXoNCisIS',1,'2026-06-21 13:37:43','2026-06-21 13:28:17','2026-06-21 13:27:43','2026-06-21 13:28:17'),(24,2,'$2y$12$kTqIddIInRrLMeSevrDjBu2kUlCpviA6qQpdDtoPvw./p3Fv6PI4m',0,'2026-06-21 15:01:38','2026-06-21 14:52:06','2026-06-21 14:51:38','2026-06-21 14:52:06'),(25,2,'$2y$12$NPwy1G3xJjugKVELF2N/LOrKUBG5OMS.hLFDSBuVvl/d6yI.aJC/i',0,'2026-06-21 15:08:51','2026-06-21 14:59:18','2026-06-21 14:58:51','2026-06-21 14:59:18'),(26,2,'$2y$12$u6AWCu8cCOxzjYGthxCipeYrKDyNf6DIzAUTi5Dcd0vPY.U/wv2VO',0,'2026-06-21 15:14:15','2026-06-21 15:04:30','2026-06-21 15:04:15','2026-06-21 15:04:30'),(27,2,'$2y$12$NPbfmwuhVHMgZHjoQXHBQOteUgzMICcXBWBowPSP1ZTvVJs5fLUki',0,'2026-06-21 19:13:52','2026-06-21 19:04:20','2026-06-21 19:03:52','2026-06-21 19:04:20'),(28,2,'$2y$12$f9kPEYYgP8WdeYj0eJwcCOtlJWK1ZU53vfdFz.5iYIETRcNx39/ie',0,'2026-06-21 20:13:02','2026-06-21 20:03:28','2026-06-21 20:03:02','2026-06-21 20:03:28'),(29,2,'$2y$12$wc5.HvRd/xHG2WdeSqxEDu0B5peSD7/bjKsAw8Ak9xWpdeQhsSfR6',0,'2026-06-21 22:00:28','2026-06-21 21:51:00','2026-06-21 21:50:28','2026-06-21 21:51:00'),(30,2,'$2y$12$ATR.o974H0jO49kJlsejL.u1CnvvKdjjDa0k2tqkz6Ip3FGO7rPI.',0,'2026-06-21 22:37:12','2026-06-21 22:27:42','2026-06-21 22:27:12','2026-06-21 22:27:42');
/*!40000 ALTER TABLE `otp_challenges` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_adjustments`
--

DROP TABLE IF EXISTS `payment_adjustments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_adjustments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `payment_id` bigint unsigned NOT NULL,
  `created_by` bigint unsigned NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `payment_adjustments_payment_id_foreign` (`payment_id`),
  KEY `payment_adjustments_created_by_foreign` (`created_by`),
  CONSTRAINT `payment_adjustments_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `payment_adjustments_payment_id_foreign` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_adjustments`
--

LOCK TABLES `payment_adjustments` WRITE;
/*!40000 ALTER TABLE `payment_adjustments` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_adjustments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_lines`
--

DROP TABLE IF EXISTS `payment_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_lines` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `payment_id` bigint unsigned NOT NULL,
  `order_item_id` bigint unsigned NOT NULL,
  `quantity` int unsigned NOT NULL,
  `unit_price` decimal(14,2) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `payment_lines_payment_id_foreign` (`payment_id`),
  KEY `payment_lines_order_item_id_foreign` (`order_item_id`),
  CONSTRAINT `payment_lines_order_item_id_foreign` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `payment_lines_payment_id_foreign` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_lines`
--

LOCK TABLES `payment_lines` WRITE;
/*!40000 ALTER TABLE `payment_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `payment_number` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` bigint unsigned NOT NULL,
  `cashier_id` bigint unsigned NOT NULL,
  `method` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'cash',
  `amount` decimal(14,2) NOT NULL,
  `cash_received` decimal(14,2) NOT NULL,
  `change_due` decimal(14,2) NOT NULL DEFAULT '0.00',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'completed',
  `paid_at` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payments_payment_number_unique` (`payment_number`),
  KEY `payments_order_id_foreign` (`order_id`),
  KEY `payments_cashier_id_foreign` (`cashier_id`),
  KEY `payments_status_index` (`status`),
  CONSTRAINT `payments_cashier_id_foreign` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `payments_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_activity` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES ('4T7v3uxIV9VeGAZrHJKwK4JUuJ6wLOZPYjMd5Bq0',NULL,'127.0.0.1','curl/8.7.1','eyJfdG9rZW4iOiJqSUdZZ25McU4zQ1h0dmxudGxTYXJGYkkwaHNEVmlYRmNwanpMTUVzIiwiX3ByZXZpb3VzIjp7InVybCI6Imh0dHA6XC9cLzEyNy4wLjAuMTo4MDAwXC9sb2dpbiIsInJvdXRlIjoibG9naW4ifSwiX2ZsYXNoIjp7Im9sZCI6W10sIm5ldyI6W119fQ==',1782082765),('G9dqeQbfzYIqdQsHgSZWGU6YZvOCCTRViQE4QrRz',1,'127.0.0.1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36','eyJfdG9rZW4iOiJRazcwczBhczBaOENHVDBwZ2dBTW9nbUhnUm1ZeXh2MXlHeTFPc2dRIiwiX2ZsYXNoIjp7Im9sZCI6W10sIm5ldyI6W119LCJfcHJldmlvdXMiOnsidXJsIjoiaHR0cDpcL1wvbG9jYWxob3N0OjgwMDBcL2FwaVwvdjFcL25vdGlmaWNhdGlvbnMiLCJyb3V0ZSI6bnVsbH0sImxvZ2luX3dlYl81OWJhMzZhZGRjMmIyZjk0MDE1ODBmMDE0YzdmNThlYTRlMzA5ODlkIjoxfQ==',1782084862),('JSPEtwCpDY9cikOAcP3EJ2I6OleaSgdeiNhmLWtV',NULL,'127.0.0.1','curl/8.7.1','eyJfdG9rZW4iOiI1dzBlTE5ZOE1iMzQzYmxVbE1wSWJtVzc2UFNINUlPTmlwZ0Z1enZFIiwidXJsIjp7ImludGVuZGVkIjoiaHR0cDpcL1wvMTI3LjAuMC4xOjgwMDAifSwiX2ZsYXNoIjp7Im9sZCI6W10sIm5ldyI6W119fQ==',1782081415),('mYtt2Cxxr1F2yhcbgsLJ9mgT0tphpTa92w206zIS',1,'127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36','eyJfdG9rZW4iOiJYNjdqVDZOU1lzdThYdHRxaTI1U01RTDljY21BcUt3dDVvUEtGWmdRIiwiX3ByZXZpb3VzIjp7InVybCI6Imh0dHA6XC9cLzEyNy4wLjAuMTo4MDAwXC9hcGlcL3YxXC9ub3RpZmljYXRpb25zIiwicm91dGUiOm51bGx9LCJfZmxhc2giOnsib2xkIjpbXSwibmV3IjpbXX0sImxvZ2luX3dlYl81OWJhMzZhZGRjMmIyZjk0MDE1ODBmMDE0YzdmNThlYTRlMzA5ODlkIjoxfQ==',1782082360);
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'employee',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `remember_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_username_unique` (`username`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_role_index` (`role`),
  KEY `users_is_active_index` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Quản trị viên','admin','admin@donglay.local','2026-06-20 10:07:53','$2y$12$m8Iow7OFKNXGmoEGdRUxTO191WJaWLjbDcReojBFYu06jvxK47bYu','admin',1,NULL,'2026-06-20 10:07:53','2026-06-21 05:16:46'),(2,'Nguyễn Chính Trực',NULL,'nguyentruc766@gmail.com','2026-06-20 10:07:53',NULL,'employee',1,NULL,'2026-06-20 10:07:53','2026-06-20 10:21:54');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-22  6:34:24
