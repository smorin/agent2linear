import { Box, Text } from 'ink';
import React from 'react';

interface WalkthroughScreenProps {
	title: string;
	icon?: string;
	description: string;
	examples?: string[];
	currentStep?: number;
	totalSteps?: number;
	footer?: string;
}

export const WalkthroughScreen: React.FC<WalkthroughScreenProps> = ({
	title,
	icon,
	description,
	examples,
	currentStep,
	totalSteps,
	footer = '[Press Enter to continue]',
}) => {
	return (
		<Box flexDirection="column" gap={1}>
			{/* Title */}
			<Box>
				<Text bold color="cyan">
					{icon && `${icon} `}
					{title}
				</Text>
			</Box>

			{/* Separator */}
			<Box>
				<Text color="gray">{'━'.repeat(50)}</Text>
			</Box>

			{/* Description */}
			<Box>
				<Text>{description}</Text>
			</Box>

			{/* Examples */}
			{examples && examples.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					<Text color="yellow">Examples:</Text>
					{examples.map((example, idx) => (
						<Box key={idx} marginLeft={2}>
							<Text color="gray">$ </Text>
							<Text color="green">{example}</Text>
						</Box>
					))}
				</Box>
			)}

			{/* Progress indicator */}
			{currentStep !== undefined && totalSteps !== undefined && (
				<Box marginTop={1}>
					<Text color="gray">
						[Page {currentStep}/{totalSteps}]
					</Text>
				</Box>
			)}

			{/* Footer */}
			<Box marginTop={1}>
				<Text color="gray" dimColor>
					{footer}
				</Text>
			</Box>
		</Box>
	);
};
