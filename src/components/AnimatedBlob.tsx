import { useEffect, useRef } from "react";

export function AnimatedBlob() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
		if (!ctx) return;

		let animationFrameId: number;
		let time = 0;
		const points: Array<{
			x: number;
			y: number;
			baseX: number;
			baseY: number;
			noiseOffsetX: number;
			noiseOffsetY: number;
		}> = [];

		// Create asymmetric shape points
		const numPoints = 8;
		for (let i = 0; i < numPoints; i++) {
			const angle = (Math.PI * 2 * i) / numPoints;
			// Create irregular base distances for asymmetry
			const distance = i % 2 === 0 ? 20 : 10;
			const x = canvas.width / 2 + Math.cos(angle) * distance;
			const y = canvas.height / 2 + Math.sin(angle) * distance;
			points.push({
				x,
				y,
				baseX: x,
				baseY: y,
				noiseOffsetX: Math.random() * 1000,
				noiseOffsetY: Math.random() * 1000,
			});
		}

		const render = () => {
			time += 0.015;
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			// Update point positions with noise
			points.forEach((point) => {
				point.noiseOffsetX += 0.02;
				point.noiseOffsetY += 0.02;
				const noiseX = Math.sin(point.noiseOffsetX) * 10;
				const noiseY = Math.cos(point.noiseOffsetY) * 10;
				point.x = point.baseX + noiseX;
				point.y = point.baseY + noiseY;
			});

			// Draw the blob
			ctx.beginPath();
			ctx.moveTo(
				(points[0].x + points[points.length - 1].x) / 2,
				(points[0].y + points[points.length - 1].y) / 2
			);

			// Create smooth curves between points
			for (let i = 0; i < points.length; i++) {
				const current = points[i];
				const next = points[(i + 1) % points.length];
				const xc = (current.x + next.x) / 2;
				const yc = (current.y + next.y) / 2;
				ctx.quadraticCurveTo(current.x, current.y, xc, yc);
			}

			ctx.closePath();

			// Create gradient fill
			const gradient = ctx.createRadialGradient(
				canvas.width / 2,
				canvas.height / 2,
				0,
				canvas.width / 2,
				canvas.height / 2,
				20
			);
			gradient.addColorStop(0, "rgb(22, 88, 181)");
			gradient.addColorStop(1, "rgb(64, 144, 255)");

			// Apply fill
			ctx.fillStyle = gradient;
			ctx.fill();

			// Add subtle glow effect
			ctx.shadowColor = "rgba(21, 86, 177, 0.5)";
			ctx.shadowBlur = 10;
			ctx.strokeStyle = "rgba(8, 97, 222, 0.92)";
			ctx.lineWidth = 0.5;
			ctx.stroke();
			ctx.shadowBlur = 0;

			// Add subtle inner details
			ctx.beginPath();
			ctx.moveTo(points[0].x, points[0].y);
			for (let i = 1; i < points.length; i += 2) {
				const xc = (points[i].x + points[(i + 1) % points.length].x) / 2;
				const yc = (points[i].y + points[(i + 1) % points.length].y) / 2;
				ctx.lineTo(xc, yc);
			}
			ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
			ctx.stroke();

			animationFrameId = requestAnimationFrame(render);
		};

		render();
		return () => cancelAnimationFrame(animationFrameId);
	}, []);

	return (
		<canvas
			ref={canvasRef}
			width={60}
			height={50}
			data-testId="animated-blob"
		/>
	);
}
