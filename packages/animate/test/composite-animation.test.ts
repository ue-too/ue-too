import { Point } from "@ue-too/math";
import { Animation, Animator, CompositeAnimation } from "../src/composite-animation";
import { Keyframe, PointAnimationHelper, NumberAnimationHelper } from "../src/animatable-attribute";


class AnimationMockClass {
    private position: Point;

    constructor(position: Point){
        this.position = position;
    }

    setPosition(destinationPos: Point){
        this.position = destinationPos;
    }

    getPosition(): Point{
        return this.position
    }
}

describe("Animation Class Tests", ()=>{

    let testAnimator: Animation<Point>;
    let exampleObj: AnimationMockClass;

    beforeEach(()=>{

        const positionKeyframes: Keyframe<Point>[] = [];

        positionKeyframes.push({percentage: 0, value: {x: 0, y: 0}});
        positionKeyframes.push({percentage: 0.4, value: {x: 1.7, y: 1.7}});
        positionKeyframes.push({percentage: 0.5, value: {x: 3, y: 3}});
        positionKeyframes.push({percentage: 1, value: {x: 10, y: 10}});

        exampleObj = new AnimationMockClass({x: 0, y: 0});
        testAnimator = new Animation(positionKeyframes, (value: Point)=>{exampleObj.setPosition(value)}, new PointAnimationHelper());
    });

    test("Without starting an animation the animated attribute won't change", ()=>{
        const deltaTime = 0.1;
        let time = 0;
        while (time <= 1){
            testAnimator.animate(deltaTime);
            time += deltaTime;
        }
        expect(exampleObj.getPosition()).toEqual({x: 0, y: 0});
    });

    test("Stopping the animation would stop the animation", ()=>{
        const deltaTime = 0.1;
        let time = 0;
        testAnimator.start();
        let expectedPosition: Point = {x: 0, y: 0};
        while (time <= 1){
            if(time == 0.4){
                testAnimator.stop();
                expectedPosition = exampleObj.getPosition();
            }
            testAnimator.animate(deltaTime);
            time += deltaTime;
        }
        expect(exampleObj.getPosition()).toEqual(expectedPosition);
    });

    test("Animation is played according to keyframes", ()=>{
        const deltaTime = 100;
        let time = 0;
        testAnimator.start();
        while (time <= 1000){
            if(time == 500){
                expect(exampleObj.getPosition().x).toBeCloseTo(3);
                expect(exampleObj.getPosition().y).toBeCloseTo(3);
            }
            testAnimator.animate(deltaTime);
            time += deltaTime;
        }
    });

    test("Reverse Animation", ()=>{
        const deltaTime = 0.01;
        let time = 0;
        testAnimator.toggleReverse(true);
        testAnimator.start();
        while (time <= 1){
            if(time == 0.6){
                expect(exampleObj.getPosition().x).toBeCloseTo(1.7);
                expect(exampleObj.getPosition().y).toBeCloseTo(1.7);
            }
            testAnimator.animate(deltaTime);
            time += deltaTime;
        }
    });

});

describe("Composite Animation Tests", ()=>{

    let testAnimator: CompositeAnimation;
    let firstAnimation: Animation<Point>;
    let secondAnimation: Animation<number>;
    let exampleObj: AnimationMockClass;
    let animatedNumber: number;

    beforeEach(()=>{
        animatedNumber = 0;
        const positionKeyframes: Keyframe<Point>[] = [];

        positionKeyframes.push({percentage: 0, value: {x: 0, y: 0}});
        positionKeyframes.push({percentage: 0.5, value: {x: 3, y: 3}});
        positionKeyframes.push({percentage: 1, value: {x: 10, y: 10}});
        let numberKeyframes: Keyframe<number>[] = [
            {percentage: 0, value: 0},
            {percentage: 0.5, value: 3},
            {percentage: 1, value: 10},
        ];
        exampleObj = new AnimationMockClass({x: 0, y: 0});
        firstAnimation = new Animation(positionKeyframes, (value: Point)=>{exampleObj.setPosition(value)}, new PointAnimationHelper());
        secondAnimation = new Animation(numberKeyframes, (value: number)=>{animatedNumber = value}, new NumberAnimationHelper());
        let animationMap = new Map<string, {animator: Animator, startTime: number}>();
        animationMap.set("first", {animator: firstAnimation, startTime: 0});
        animationMap.set("second", {animator: secondAnimation, startTime: 0});
        testAnimator = new CompositeAnimation(animationMap);
    });

    test("Without starting an animation the animated attribute won't change", ()=>{
        const deltaTime = 0.1;
        let time = 0;
        while (time <= 1){
            testAnimator.animate(deltaTime);
            time += deltaTime;
        }
        expect(exampleObj.getPosition()).toEqual({x: 0, y: 0});
        expect(animatedNumber).toEqual(0);
    });

    test("Stopping the animation would stop the animation", ()=>{
        const deltaTime = 100;
        let time = 0;
        testAnimator.start();
        let expectedPosition: Point = {x: 0, y: 0};
        let expectedNumber: number = 0;
        while (time <= 1000){
            if(time == 400){
                testAnimator.pause();
                expectedPosition = exampleObj.getPosition();
                expectedNumber = animatedNumber;
            }
            testAnimator.animate(deltaTime);
            time += deltaTime;
        }
        expect(exampleObj.getPosition()).toEqual(expectedPosition);
        expect(animatedNumber).toBeCloseTo(2.4);
    });

    test("Animation is played according to keyframes", ()=>{
        const deltaTime = 100;
        let time = 0;
        testAnimator.start();
        while (time <= 1000){
            if(time == 500){
                expect(exampleObj.getPosition().x).toBeCloseTo(3);
                expect(exampleObj.getPosition().y).toBeCloseTo(3);
                expect(animatedNumber).toBeCloseTo(3);
            }
            testAnimator.animate(deltaTime);
            time += deltaTime;
        }
    });

    test("Change the duration", ()=>{
        const deltaTime = 0.1;
        let time = 0;
        testAnimator.duration = 2;
        testAnimator.start();
        while (time <= testAnimator.duration){
            if(time == 1){
                expect(exampleObj.getPosition().x).toBeCloseTo(3);
                expect(exampleObj.getPosition().y).toBeCloseTo(3);
                expect(animatedNumber).toBeCloseTo(3);
            }
            testAnimator.animate(deltaTime);
            time += deltaTime;
        }
        expect(exampleObj.getPosition().x).toBeCloseTo(10);
        expect(exampleObj.getPosition().y).toBeCloseTo(10);
        expect(animatedNumber).toBeCloseTo(10);

    });

    test("Add composite animation to another composte animation", ()=>{
        let thirdAnimation: Animation<number>;
        let animatedNumber2: number;
        animatedNumber2 = 0;
        let numberKeyframes: Keyframe<number>[] = [
            {percentage: 0, value: 0},
            {percentage: 0.5, value: 3},
            {percentage: 1, value: 10},
        ];
        thirdAnimation = new Animation(numberKeyframes, (value: number)=>{animatedNumber2 = value}, new NumberAnimationHelper());
        let animationMap = new Map<string, {animator: Animator, startTime: number}>();
        const secondCompositeAnimation = new CompositeAnimation(animationMap);
        secondCompositeAnimation.addAnimation("third", thirdAnimation);
        testAnimator.addAnimation("third", secondCompositeAnimation);
        const deltaTime = 0.1;
        let time = 0;
        testAnimator.duration = 10;
        testAnimator.start();
        while (time <= testAnimator.duration){
            if(time == 5){
                expect(exampleObj.getPosition().x).toBeCloseTo(3);
                expect(exampleObj.getPosition().y).toBeCloseTo(3);
                expect(animatedNumber).toBeCloseTo(3);
                expect(animatedNumber2).toBeCloseTo(3);
            }
            testAnimator.animate(deltaTime);
            time += deltaTime;
        }
    });

    test("Check if the composite animation is a child of its own children; thus a cyclic tree", ()=>{
        let thirdAnimation: Animation<number>;
        let animatedNumber2: number;
        animatedNumber2 = 0;
        let numberKeyframes: Keyframe<number>[] = [
            {percentage: 0, value: 0},
            {percentage: 0.5, value: 3},
            {percentage: 1, value: 10},
        ];
        thirdAnimation = new Animation(numberKeyframes, (value: number)=>{animatedNumber2 = value}, new NumberAnimationHelper());
        let animationMap = new Map<string, {animator: Animator, startTime: number}>();
        const secondCompositeAnimation = new CompositeAnimation(animationMap);
        secondCompositeAnimation.addAnimation("third", thirdAnimation);
        testAnimator.addAnimation("third", secondCompositeAnimation);
        secondCompositeAnimation.addAnimation("test", testAnimator);
        expect(testAnimator.checkCyclicChildren()).toBe(false);
    });
});
