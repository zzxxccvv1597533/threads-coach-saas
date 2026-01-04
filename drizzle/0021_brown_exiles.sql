ALTER TABLE `keyword_benchmarks` ADD `funnelSuggestions` json;--> statement-breakpoint
ALTER TABLE `keyword_benchmarks` ADD `stabilityScore` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `keyword_benchmarks` ADD `burstScore` int DEFAULT 0;